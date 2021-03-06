"use strict";
const pulumi = require("@pulumi/pulumi");
const aws = require("@pulumi/aws");
const eks = require("@pulumi/eks");
// to get values from pulumi yaml file
var config = new pulumi.Config();
// get environment value
var env = config.require("environment");


module.exports = function (whichCluster) {
  // [env=environment, clustname=cluster name, version= k8s version, ngname= nodegroup name, insttype= ec2 machine type, sptprice = spot price, dsrcapacity = desired capacity, minsize= minimum size, maxsize= maximum size]
  //get clustter parameters from pulumi yaml file
  var clustvalues = config.requireObject(whichCluster);
  const vpcid = clustvalues.vpcId;
  const privatesnetids = clustvalues.privateSubnets
  const publicsnetids = clustvalues.publicSubnets
  var Userdata ; // this is a variable to hold userdata value depending on windows or linux

  // For user created node groups to be attached , A role and instance profile needs to be created.

  /**
   * Per NodeGroup IAM: each NodeGroup will bring its own, specific instance role and profile.
   */
  // This policy is needed for cluster autoscallign to work.
  const aspolicy = new aws.iam.Policy(`${clustvalues.clustername}-policy`, {
    description: "Policy that is needed for cluster autoscalling",
    policy: `{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Action": [
                "autoscaling:DescribeAutoScalingGroups",
                "autoscaling:DescribeAutoScalingInstances",
                "autoscaling:DescribeLaunchConfigurations",
                "autoscaling:DescribeTags",
                "autoscaling:SetDesiredCapacity",
                "autoscaling:TerminateInstanceInAutoScalingGroup",
                "ec2:DescribeLaunchTemplateVersions"
            ],
            "Resource": "*",
            "Effect": "Allow"
        }
    ]
}
`,
  });

  const managedPolicyArns = [
    "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy",
    "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy",
    "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly",
    aspolicy.arn,
  ];
  // Creates a role and attches the EKS worker node IAM managed policies
  function createRole(name) {
    const frole = new aws.iam.Role(name, {
      assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
        Service: "ec2.amazonaws.com",
      }),
    });
    let counter = 0;
    for (const policy of managedPolicyArns) {
      // Create RolePolicyAttachment without returning it.
      const rpa = new aws.iam.RolePolicyAttachment(
        `${name}-policy-${counter++}`,
        { policyArn: policy, role: frole }
      );
    }
    return frole;
  }

  // Now create the roles and instance profiles for the two worker groups.
  const myrole = createRole(`${clustvalues.clustername}-worker-role`);
  const instanceProfile1 = new aws.iam.InstanceProfile(
    `${clustvalues.clustername}-instance-profile`,
    {
      role: myrole,
    }
  );

  const asgtag = `k8s.io/cluster-autoscaler/${clustvalues.clustername}`;

  // Create an EKS cluster with the specific configuration.

  const cluster1 = new eks.Cluster(clustvalues.clustername, {
    name: clustvalues.clustername,
    vpcId: vpcid,
    subnetIds: publicsnetids,
    nodeAssociatePublicIpAddress: false,
    createOidcProvider: true,
    deployDashboard: false,
    version: clustvalues.version,
    endpointPrivateAccess: true,
    endpointPublicAccess: false,
    skipDefaultNodeGroup: true,
    instanceRoles: [myrole],
  });
  // Fetch computed values from cluster creation like server endpoint cadata etc..

  const userdata = pulumi
    .all([
      cluster1.eksCluster.name,
      cluster1.eksCluster.endpoint,
      cluster1.eksCluster.certificateAuthority.data,
    ])
    .apply(
      ([name, ep, ca]) =>
        `[settings]

  [settings.host-containers]

    [settings.host-containers.admin]

      # Bottlerocket Admin Container
      enabled = false

  [settings.kubernetes]

    # Kubernetes Control Plane API Endpoint
    api-server = "` +
        ep +
        `"

    # Kubernetes Cluster CA Certificate
    cluster-certificate = "` +
        ca +
        `"

    # Kubernetes Cluster Name
    cluster-name = "` +
        name +
        `"

    [settings.kubernetes.node-labels]
      "created-by" = "harcoded-toml-file"
      "preemptible" = "true"`
    );
    
  const Windowsuserdata = pulumi
    .all([
      cluster1.eksCluster.name,
      cluster1.eksCluster.endpoint,
      cluster1.eksCluster.certificateAuthority.data,
    ])
    .apply(
      ([name, ep, ca]) =>
        `<powershell>
[string]$EKSBinDir = "$env:ProgramFiles\Amazon\EKS"
[string]$EKSBootstrapScriptName = 'Start-EKSBootstrap.ps1'
[string]$EKSBootstrapScriptFile = "$EKSBinDir\$EKSBootstrapScriptName"
& $EKSBootstrapScriptFile -EKSClusterName`+name+`-KubeletExtraArgs "" 3>&1 4>&1 5>&1 6>&1
$LastError = if ($?) { 0 } else { $Error[0].Exception.HResult }
</powershell>`
    );
 
  //create bottlerocket node group. put this block in a for loop to create all node groups from config file.
  for (var i = 0; i < clustvalues.nodegroup.length; i++) {
    switch (clustvalues.nodegroup[i].ostype){
      case 'linux':
        Userdata = userdata
        break;
        case 'windows':
          Userdata = Windowsuserdata
          break;
    }
    cluster1.createNodeGroup(clustvalues.nodegroup[i].name, {
      name: `${clustvalues.nodegroup[i].name}-node-group-pulumi`,
      instanceType: clustvalues.nodegroup[i].machinetype,
      autoScalingGroupTags: {
        ["k8s.io/cluster-autoscaler/enabled"]: "true",
        [asgtag]: "owned",
      },
      spotPrice: clustvalues.nodegroup[i].spotprice,
      nodeAssociatePublicIpAddress: false,
      nodeSubnetIds: privatesnetids,
      desiredCapacity: clustvalues.nodegroup[i].desiredcapacity,
      //amiId: "ami-00d7f1aeda5144f18", // Bottlerocket ami for x86_64 is ami-00d7f1aeda5144f18 anf for arm64 it is ami-0f1b1774093ac0c54 anf ami-0d482532a36d9ff7a is ubuntu eks optimised.
      amiId: clustvalues.nodegroup[i].amiId,
      nodeRootVolumeSize: clustvalues.nodegroup[i].dSize,
      minSize: clustvalues.nodegroup[i].minimumsize,
      nodeUserDataOverride: Userdata,
      //extraNodeSecurityGroups: [sg1],

      maxSize: clustvalues.nodegroup[i].maximumsize,
      //labels: { "preemptible": "true" }, // when using custom user data labels must be specified in custom userdata and not here.
      /*taints: {
              "special": {
                  value: "true",
                  effect: "NoSchedule",
              },
          },*/
      instanceProfile: instanceProfile1,
    });
  }

  // Export the cluster's kubeconfig.
  //exports.kubeconfig = cluster1.kubeconfig;
  exports.clustername = cluster1.eksCluster.name;
};
