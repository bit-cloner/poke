### POKE - Provision Opinianated Kubernetes on EKS ![alt text](pokelogo.png "POKE")
Poke is infrastrucure as software to provision EKS cluster in an opinianated way.
Code is written in nodejs utilising pulumi framework.
It is opinianated in such a way to improve security and simplicity.

1. VPC and subnets used are pre existing
2. Control plane API is private
3. Subnets are private
4. Default Dashboard is disabled
5. Autoscalling of worker groups is enabled
6. Nodes in worker group have private ip addresses only
7. Default node group is skiped
8. Uses spot instances for worker nodes
9. Has the ability to attach existing security groups to worker nodes.
10. HAs the ability to provision both Linux and Windows worker groups