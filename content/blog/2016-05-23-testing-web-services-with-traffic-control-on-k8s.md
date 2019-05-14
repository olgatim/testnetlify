+++
authors = ["Alessandro Puccetti"]
date = "2016-05-23T10:40:28+02:00"
description = ""
draft = false
tags = ["containers", "kubernetes", "k8s", "openshift", "weaveworks", "tcd", "traffic control"]
title = "Testing web services with traffic control on Kubernetes"
topics = ["Testing", "Operations", "Networking"]
postImage =  "article-hero.jpg"

+++

This is part 2 of our “testing applications with traffic control series”. See part 1, [testing degraded network scenarios with rkt](https://kinvolk.io/blog/2016/02/testing-degraded-network-scenarios-with-rkt/), for detailed information about how traffic control works on Linux.

In this installment we demonstrate how to test web services with traffic control on [Kubernetes](http://kubernetes.io/). We introduce [tcd](https://github.com/kinvolk/tcd), a simple traffic control daemon developed by Kinvolk for this demo. Our demonstration system runs on [Openshift 3](https://www.openshift.com/), Red Hat’s Container Platform based on Kubernetes, and uses the excellent [Weave Scope](https://www.weave.works/products/weave-scope/), an interactive container monitoring and visualization tool.

We’ll be giving a live demonstration of this at the [OpenShift Commons Briefing](https://commons.openshift.org/briefings.html) on May 26th, 2016. Please join us there.

## The premise
As discussed in part 1 of this series, tests generally run under optimal networking conditions. This means that standard testing procedures neglect a whole bevy of issues that can arise due to poor network conditions.

Would it not be prudent to also test that your services perform satisfactorily when there is, for example, high packet loss, high latency, a slow rate of transmission, or a combination of those? We think so, and if you do too, please read on.

# Traffic control on a distributed system
Let’s now make things more concrete by using tcd in our Kubernetes cluster.

### The setup
To get started, we need to start an [OpenShift ready VM](https://github.com/kinvolk/openshift-evangelists-vagrant-origin) to provide us our Kubernetes cluster. We’ll then create an OpenShift project and do some configuration.

If you want to follow along, you can go to our [demo repository](https://github.com/kinvolk/demo) which will guide you through installing and setting up things.
The pieces
Before diving into the traffic control demo, we want to give you a really quick overview of tcd, OpenShift and Weave Scope.

#### tcd (traffic control daemon)
tcd is a simple daemon that runs on each Kubernetes node and responds to API calls. tcd manipulates the traffic control settings of the pods using the [```tc```](http://man7.org/linux/man-pages/man8/tc.8.html) command which we briefly mentioned in part 1. It’s decoupled from the service being tested, meaning you can stop and restart the daemon on a pod without affecting its connectivity.

In this demo, it receives commands from buttons exposed in Weave Scope.

#### OpenShift
OpenShift is Red Hat’s container platform that makes it simple to build, deploy, manage and secure containerized applications at scale on any cloud infrastructure, including Red Hat’s own hosted offering, [OpenShift Dedicated](https://www.openshift.com/dedicated/). Version 3 of OpenShift uses Kubernetes under the hood to maintain cluster health and easily scale services.

In the following figure, you see an example of the OpenShift dashboard with the running pods.

<figure class="img-fluid">
	<img src="/media/openshift_ui.png" class="img-fluid">
</figure>

Here we have 1 Weave Scope App pod, 3 ping test pods, 1 tcd pod, and one Weave Scope App. Using the arrow buttons one can scale the application up and down and the circle changes color depending on the status of the application (e.g. scaling, terminating, etc.).

#### Weave Scope
Weave Scope helps to intuitively understand, monitor, and control containerized applications. It visually represents pods and processes running on Kubernetes and allows one to drill into pods, showing information such as CPU & memory usage, running processes, etc. One can also stop, start, and interact with containerized applications directly through its UI.

<figure class="img-fluid">
	<img src="/media/weave_scope_ui_ping.png" class="img-fluid">
</figure>

While this graphic shows Weave Scope displaying containers, we see at the top that we can also display information about processes and hosts.

### How the pieces fit together
Now that we understand the individual pieces, let’s see how it all works together. Below is a diagram of our demo system.

{{< figure src="/media/architecture-tcd-scope.svg">}}

Here we have 2 Kubernetes nodes each running one instance of the tcd daemon. tcd can only manage the traffic control settings of pods local to the Kubernetes node on which it’s running, thus the need for one per node.

On the right we see the Weave Scope app showing details for the selected pod; in this case, the one being pointed to by (4). In the red oval, we see the three buttons we’ve added to Scope app for this demo. These set the network connectivity parameters of the selected pod’s egress traffic to a latency of 2000ms, 300ms, 1ms, respectively, from left to right.

When clicked (1), the scope app sends a message (2) to the Weave Scope probe running on the selected pod’s Kubernetes node. The Weave Scope probe sends a [gRPC](http://www.grpc.io/) message (3) to the tcd daemon, in this case a [ConfigureEgressMethod](https://github.com/kinvolk/tcd/blob/master/api/service.proto#L41) message, running on its Kubernetes node telling it to configure the pods egress traffic (4) accordingly.

While this demo only configures the latency, tcd can also be used to configure the bandwidth and the percentage of packet drop. As we saw in part 1, those parameters are features directly provided by the Linux [netem queuing discipline](http://www.linuxfoundation.org/collaborate/workgroups/networking/netem).

<figure class="img-fluid">
	<img src="/media/netem.png" class="img-fluid">
</figure>

Being able to dynamically change the network characteristics for each pod, we can observe the behaviour of services during transitions as well as in steady state. Of course, by observe we mean **test**,which we’ll turn to now.


# Testing with traffic control

Now for 2 short demos to show how traffic control can be used for testing. 

## Ping test
This is a contrived demo to show that the setup works and we can, in fact, manipulate the egress traffic characteristics of a pod.

The following video shows a pod downloading a small file from Internet with the ```wget``` command, with the target host being the one for which we are adjusting the packet latency.

{{< youtube OwTjtPMmmn8 >}}

It should be easy to see the affects that adjusting the latency has; with greater latency it takes longer to get a reply.

## Guestbook app test
We use the [Kubernetes guestbook example](https://github.com/kubernetes/kubernetes/tree/master/examples/guestbook) for our next, more real-world, demo. Some small modifications have been made to provide user-feedback when the reply from the web server takes a long time, showing a “loading…” message. Generally, this type of thing goes untested because, as we mentioned in the introduction, our tests run under favorable networking conditions.

Tools like [Selenium](http://www.seleniumhq.org/) and [agouti](https://godoc.org/github.com/sclevine/agouti) allow for testing web applications in an automated way without manually interacting with a browser. For this demo we’ll be using agouti with its Chrome backend so that we can see the test run.

In the following video we see this feature being automatically tested by a [Go script](https://github.com/kinvolk/demo/tree/master/traffic-control-k8s/potato-test) using the [Ginkgo testing framework](https://onsi.github.io/ginkgo/) and [Gomega matcher library](https://onsi.github.io/gomega/).

{{< youtube rwSdoAEGgDw >}}

In this demo, testers still need to configure the traffic control latency manually by clicking on the Weave Scope app buttons before running the test. However, since tcd can accept commands over gRPC, the Go script could easily connect to tcd to perform that configuration automatically, and dynamically, at run time. We’ll leave that as an exercise for the reader. :)

# Conclusion
With Kubernetes becoming a defacto building block of modern container platforms, we now have a basis on which to start integrating features in a standardized way that have long gone ignored. We think traffic control for testing, and other creative endeavors, is a good example of this.

If you’re interested in moving this forward, we encourage you to take what we’ve started and run with it. And whether you just want to talk to us about this or you need professional support in your efforts, we’d be happy to talk to you.


## Thanks to...
We’d like to thank [Ilya](https://github.com/errordeveloper) & [Tom](https://twitter.com/tom_wilkie) from [Weaveworks](https://www.weave.works/) and [
Jorge](https://twitter.com/@UnPOUcoDe) & [Ryan
](https://twitter.com/ryanj) from [Red Hat](https://www.redhat.com) for helping us with some technical issues we ran into while setting up this demo. And a special thanks to [Diane](https://twitter.com/pythondj) from the OpenShift project for helping coordinate the effort.


