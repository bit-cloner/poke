### POKE - Provision Opinionated Kubernetes on EKS ![alt text](pokelogo.png "POKE")
Poke is infrastructure as software to provision EKS cluster in an opinianated way.
Code is written in nodejs utilising pulumi framework.
It is opinianated in such a way to improve security and simplicity.Consider this similar to terraform module. This package can be used to provision eks clusters declaratively with immutability and repeatability.

Please note thi is a MVP and code quality isn't that great. But the good thing is it works.
I should probably make some code optimisations going forward. I welcome PRs to make improvements.


It has following capabilities
1. Has the ability to create multiple clusters with multiple worker node groups with a mix of Linux and windows nodes.
2. Control plane API is private
3. Subnets are private
4. Default Dashboard is disabled
5. Autoscalling of worker groups is enabled
6. Nodes in worker group have private ip addresses only
7. Default node group is skiped
8. Uses spot instances for worker nodes
9. Has the ability to attach existing security groups to worker nodes.
10. Has the ability to provision both Linux and Windows worker groups
11. VPC and subnets used are pre existing

Some of the config options can be set as per your requirements in pulumi.dev.yaml file. Pulumi keeps all the config in this file.

### Requirements
1. Pulumi CLI
2. Appropriate AWS credentials in the form of environment variables, profile, or ec2 role.
3. AWS CLI -  This is needed to fetch kubeconfig to execute kubectl commands (optional)

### How to use it
1. Clone this repository 
```
git clone https://github.com/bit-cloner/poke.git

cd poke
```
2. Set AWS credentials
```
aws configure 
```
3. Initialise Pulumi - Assuming your remote state is in AWS S3.
```
pulumi login s3://name-of-your-state-bucket
```
4. Select which stack you want to use- This repo has a dev stack
```
pulumi stack select dev
```
5. Deploy the stack
```
pulumi up
```
After you are happy with details of the plan, apply it by selecting Yes

This should create 2 clusters eks18-dev and eks19-dev as per declerations made in pulumi.dev.yaml file.
You can tweak these elements to customise as per your requirements.
For example if you want to add another cluster to your stack , add another code block and edit index.js file accordingly.

