+++
authors = ["Lili Cosic"]
date = "2017-10-09T14:15:00+02:00"
description = ""
draft = false
tags = ["habitat", "kubernetes"]
title = "Habitat Operator - Running Habitat Services with Kubernetes"
topics = ["Habitat", "Containers", "Kubernetes"]
postImage =  "article-hero.jpg"

+++

<figure class="img-fluid">
	<img src="/media/habitat-loves-kubernetes.jpg" class="img-fluid">
</figure>

For the last few months, we’ve been working with the Habitat team at [Chef](https://www.chef.io/) to make Habitat-packaged applications run well in [Kubernetes](https://kubernetes.io/). The result of this collaboration is the [Habitat Operator](https://github.com/kinvolk/habitat-operator), a Kubernetes controller used to deploy, configure and manage applications packaged with Habitat inside of Kubernetes. This article will give an overview of that work — particularly the issues to address, solutions to those issues, and future work.

## Habitat Overview
For the uninitiated, [Habitat](https://www.habitat.sh/) is a project designed to address building, deploying and running applications.
#### Building applications
Applications are built from shell scripts known as “plans” which describe how to build the application, and may optionally include configurations files and lifecycle hooks. From the information in the plan, Habitat can create a package of the application.
#### Deploy applications
In order to run an application with a container runtime like [Docker](https://www.docker.com/) or [rkt](https://github.com/rkt/rkt), Habitat supports exporting packages to a Docker container image. You can then upload the container image to a registry and use it to deploy applications to a container orchestration system like Kubernetes.
#### Running applications
Applications packaged with Habitat — hereafter referred to as simply as applications — support the following runtime features.

* [Topology models](https://www.habitat.sh/docs/using-habitat/#topologies)
* [Update strategies](https://www.habitat.sh/docs/using-habitat/#using-updates)
* [Dynamic configuration](https://www.habitat.sh/docs/using-habitat/#config-updates)
* [Health monitoring](https://www.habitat.sh/tutorials/get-started/demo/check-service-health/)
* [Application binding](https://www.habitat.sh/docs/developing-packages/#pkg-binds)

These features are available because all Habitat applications run under a supervisor process called a [Supervisor](https://www.habitat.sh/docs/glossary/#glossary-supervisor). The Supervisor takes care of restarting, reconfiguring and gracefully terminating services. The Supervisor also allows multiple instances of applications to run with the Supervisor communicating with other Supervisors via a [gossip protocol](https://www.habitat.sh/docs/internals/#supervisor-internals). These can connect to form a ring and establish [Service Groups](https://www.habitat.sh/docs/using-habitat/#service-groups) for sharing configuration data and establishing topologies.

## Integration with Kubernetes
Many of the features that Habitat provides overlap with features that are provided in Kubernetes. Where there is overlap, the Habitat Operator tries to translate, or defer, to the Kubernetes-native mechanism. One design goal of the Habitat Operator is to allow Kubernetes users to use the Kubernetes CLI without fear that Habitat applications will become out of sync. For example, update strategies are core feature of Kubernetes and should be handled by Kubernetes.

For the features that do not overlap — such as topologies and application binding — the Habitat Operator ensures that these work within Kubernetes.

#### Joining the ring

One of the fundamental challenges we faced when conforming Habitat to Kubernetes was forming and joining a ring. Habitat uses the `--peer` flag which is passed an IP address of a previously started Supervisor. But in the Kubernetes world this is not possible as all pods need to be started with the exact same command line flags. In order to be able to do this within Kubernetes, implemented a new flag in Habitat itself, `--peer-watch-file`. This flag takes a file which should contain a list of one or more IP addresses to the peers in the Service Group it would like to join. Habitat uses this information to form the ring between the Supervisors. This is implemented in the Habitat Operator using a [Kubernetes ConfigMap](https://kubernetes.io/docs/tasks/configure-pod-container/configmap/) which is mounted into each pod.

#### Initial Configuration

Habitat allows for drawing configuration information from different sources. One of them is a `user.toml` file which is used for initial configuration and is not gossiped within the ring. Because there can be sensitive data in configuration files, we use [Kubernetes Secrets](https://kubernetes.io/docs/concepts/configuration/secret/) for all configuration data. The Habitat Operator mounts configuration files in the place where Habitat expects it to be found and the application automatically picks up this configuration as it normally would. This mechanism will also be reused to support configuration updates in the future.

#### Topologies

One of these is specifying the two different topologies that are supported in Habitat. The standalone topology — the default topology in Habitat — is used for applications that are independent of one another. With the leader/follower topology, the Supervisor handles leader election over the ring before the application starts. For this topology, three or more instances of an application must be available for a successful leader election to take place.

#### Ring encryption

A security feature of Habitat that we brought into the operator is securing the ring by encrypting all communications across the network.

#### Application binding

We also added an ability to do runtime binding, meaning that applications form a producer/consumer relationship at application start. The producer exports the configuration and the consumer, through the Supervisor ring, consumes that information. You can learn more about that in the demo below:

{{< youtube IlenE7ClZHI>}}

 
## Future plans for Habitat operator
The Habitat Operator is in heavy development and we're excited about the features that we have planned for the next months.

#### Export to Kubernetes

We've already started work on a exporter for Kubernetes. This will allow you to export the application you packaged with Habitat to a Docker image along with a generated manifest file that can be used to deploy directly to Kubernetes.

#### Dynamic configuration
As mentioned above, we are planning to extend the initial configuration and use the same logic for configuration updates. This work should be landing in Habitat very soon. With Habitat applications, configuration changes can be made without restarting pods. The behaviour for how to do configuration updates is defined in the applications Habitat plan. 

#### Further Kubernetes integration and demos

We're also looking into exporting to [Helm charts](https://github.com/kubernetes/helm/blob/master/docs/charts.md) in the near future. This could allow for bringing a large collection of Habitat-packaged to Kubernetes.

Another area to explore is integration between the [Habitat Builder](https://blog.chef.io/2017/05/23/habitat-build-service-builder/) and Kubernetes. The ability to automatically recompile application, export images, and deploy to Kubernetes when dependencies are updated could bring great benefits to Habitat and Kubernetes users alike.

## Conclusion
Please take the operator for a spin [here](https://github.com/kinvolk/habitat-operator). The [first release](https://github.com/kinvolk/habitat-operator/releases/tag/v0.1.0) is now available. All you need is an application packaged with Habitat and exported as Docker image, and that functionality is already in Habitat itself. 

***Note:*** *The Habitat operator is compatible with Habitat version 0.36.0 onwards. If you have any questions feel free to ask on the [#kubernetes channel](https://habitat-sh.slack.com/messages/C2YNK74UX) in Habitat slack or open an issue on the Habitat operator.*


Follow [Kinvolk on twitter](https://twitter.com/kinvolkio) to get notified when new blog posts go live.
