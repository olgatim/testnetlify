+++
authors = ["Iago López Galeiras"]
date = "2017-11-29T15:30:00+01:00"
title = 'Announcing the Initial Release of rktlet, the rkt CRI Implementation'
description = ""
draft = false
tags = ["rktlet", "kubernetes", "systemd", "rkt", "containers", "cri"]
topics = ["Containers", "Kubernetes", "Project"]
postImage =  "article-hero.jpg"
+++

<figure class="img-fluid">
	<img src="/media/rktlet-logo.svg" class="img-fluid">
</figure>

We are happy to announce the initial release of [rktlet](https://github.com/kubernetes-incubator/rktlet), the [rkt](https://github.com/rkt/rkt/) implementation of the [Kubernetes Container Runtime Interface](http://blog.kubernetes.io/2016/12/container-runtime-interface-cri-in-kubernetes.html). This is a preview release, and is not meant for production workloads.

When using rktlet, all container workloads are run with the rkt container runtime.

# About rkt

The rkt container runtime is unique amongst container runtimes in that, once rkt is finished setting up the pod and starting the application, no rkt code is left running. rkt also takes a security-first approach, not allowing insecure functionality unless the user explicitly disables security features. And rkt is pod-native, matching ideally with the Kubernetes concept of pods. In addition, rkt prefers to integrate and drive improvements into existing tools, rather than reinvent things. And lastly, rkt allows for running apps in various isolation environments — container, VM or host/none.

# rkt support in Kubernetes

With this initial release of rktlet, rkt currently has two Kubernetes implementations. Original rkt support for Kubernetes was introduced in Kubernetes version 1.3. That implementation — which goes by the name [rktnetes](http://blog.kubernetes.io/2016/07/rktnetes-brings-rkt-container-engine-to-Kubernetes.html) — resides in the core of Kubernetes. Just as rkt itself kickstarted the drive towards standards in containers, this original rkt integration also spurred the introduction of a standard interface within Kubernetes to enable adding support for other container runtimes. This interface is known as the Kubernetes Container Runtime Interface (CRI).

With the Kubernetes CRI, container runtimes have a clear path towards integrating with Kubernetes. rktlet is the rkt implementation of that interface.

# Project goals

The goal is to make rktlet the preferred means to run workloads with rkt in Kubernetes. But companies like [Blablacar rely on the Kubernetes-internal implementation of rkt](https://kubernetes.io/case-studies/blablacar/) to run their infrastructure. Thus, we cannot just remove that implementation without having a viable alternative.

rktlet currently [passes 129 of the 145 Kubernetes end-to-end conformance tests](https://github.com/kubernetes-incubator/rktlet/issues/95#issuecomment-344598931). We aim to have full compliance. Later in this article, we’ll look at what needs remain to get there.

Once rktlet it ready, the plan is to deprecate the rkt implementation in the core of Kubernetes.

# How rktlet works

rktlet is a daemon that communicates with the [kubelet](https://kubernetes.io/docs/reference/generated/kubelet/) via [gRPC](https://grpc.io/). The CRI is the interface by which kubelet and rktlet communicate. The main CRI methods are

* RunPodSandbox(),
* PodSandboxStatus(),
* CreateContainer(),
* StartContainer(),
* StopPodSandbox(),
* ListContainers(),
* [etc.](https://github.com/kubernetes/kubernetes/blob/release-1.8/pkg/kubelet/apis/cri/v1alpha1/runtime/api.proto#L17)

These methods handle lifecycle management and gather state.

To create pods, rktlet creates a transient systemd service using `systemd-run` with the appropriate `rkt` command line invocation. Subsequent actions like adding and removing containers to and from the pods, respectively, are done by calling the `rkt` command line tool.

The following component diagram provides a visualization of what we’ve described. 

{{< figure src="/media/rktlet-interaction.svg" >}}

To try out rktlet, follow the [Getting Started guide](https://github.com/kubernetes-incubator/rktlet/blob/master/docs/getting-started-guide.md).

# Driving rkt development

Work on rktlet has spurred a couple new features inside of rkt itself which we’ll take a moment to highlight.

## Pod manipulation

rkt has always been pod-native, but the pods themselves were immutable. The original design did not allow for actions such as starting, stopping, or adding apps to a pod. These features were added to rkt in order to be CRI conformant. This work is described in the [app level API document](https://github.com/rkt/rkt/blob/master/Documentation/proposals/app-level-api.md)

## Logging and attaching

Historically, apps in rkt have offloaded logging to a sidecar service — by default systemd-journald — that multiplexes their output to the outside world. The sidecar service handled logging and interactive applications reused a parent TTY.

But the CRI defines a logging format that is plaintext whereas systemd-journald's output format is binary. Moreover, Kubernetes has [an attaching feature](https://kubernetes.io/docs/reference/generated/kubectl/kubectl-commands#attach) that couldn’t be implemented with the old design.

To solve these problems, a component called `iottymux` was implemented. When enabled, it replaces systemd-journald completely; providing app logs that are formatted to be CRI compatible and the needed logic for the attach feature.

For a more detailed description of this design, check out the [log attach design document](https://github.com/rkt/rkt/blob/master/Documentation/devel/log-attach-design.md).

# Future work for rktlet

rktlet still needs work before it’s ready for production workloads and be 100% CRI compliant. Some of the work that still needs to be done is...

* [kubectl attach](https://github.com/kubernetes-incubator/rktlet/issues/8),
* [CRI container stats](https://github.com/kubernetes-incubator/rktlet/issues/150),
* [Performance improvements](https://github.com/kubernetes-incubator/rktlet/issues/160),
* [More testing with kubernetes v1.8.x](https://github.com/kubernetes-incubator/rktlet/issues/169)
* [Documentation improvements](https://github.com/kubernetes-incubator/rktlet/issues/170)

# Join the team
If you’d like to join the effort, rktlet offers ample chances to get involved. Ongoing work is discussed in the [#sig-node-rkt Kubernetes Slack channel](https://kubernetes.slack.com/messages/C1DDHDH8D). If you're at Kubecon North America in Austin, please come by the [rkt salon](https://kccncna17.sched.com/event/CU8n/rkt-salon) to talk about rkt and rktlet.

# Thanks

Thanks to all those that have [contributed to rktlet](https://github.com/kubernetes-incubator/rktlet/graphs/contributors) and to [CoreOS](https://coreos.com/), [Blablacar](https://www.blablacar.com/), [CNCF](https://www.CNCF.io/) and our team at [Kinvolk](https://kinvolk.io/) for supporting its development.
