+++
authors = ["Iago López Galeiras"]
date = "2017-12-05T14:30:00-06:00"
title = "What's new in kube-spawn"
description = ""
draft = false
tags = ["kube-spawn", "kubernetes", "systemd", "nspawn", "containers", "machinectl", "kubeadm"]
topics = ["Containers", "Kubernetes", "Tools", "Project"]
postImage =  "article-hero.jpg"
+++

<figure class="img-fluid">
	<img src="/media/kubespawn-logo.svg" class="img-fluid">
</figure>

There’s been a number of changes in kube-spawn [kube-spawn](https://github.com/kinvolk/kube-spawn/releases) since [we announced it](https://kinvolk.io/blog/2017/08/introducing-kube-spawn-a-tool-to-create-local-multi-node-kubernetes-clusters/).

The main focus of the recent developments was improving the CLI, supporting several clusters running in parallel, and enabling developers to test Kubernetes patches easily. In addition, we've added a [bunch of documentation](https://github.com/kinvolk/kube-spawn/tree/v0.2.1/doc), improved error messages and, of course, fixed a lot of bugs.

## CLI redesign

We’ve completely redesigned the CLI commands used to interact with kube-spawn. You can now use `create` to generate the cluster environment, and then `start` to boot and provision the cluster. The convenience `up` command does the two steps in one so you can quickly get a cluster with only one command.

Once a cluster is up and running you can use `stop` to stop it and keep it there to start it again later, or `restart` to `stop` and `start` the cluster.

The command `destroy` will take a cluster in the stopped or running state and remove it completely, including any disk space the cluster was using.

The following diagram provides a visualization of the CLI workflow.

{{< figure src="/media/kubespawn-lifecycle.svg" >}}

## Multi-cluster support

Previously, users could only run one cluster at the time. With the flag `--cluster-name` flag, running multiple clusters in parallel is now possible.

All the CLI operations can take `--cluster-name` to specify which cluster you’re referring to. To see your currently created clusters, a new command `list` was added to kube-spawn.

This is especially useful when you want to test how your app behaves in different Kubernetes versions or, as a Kubernetes developer, when you made a change to Kubernetes itself and want to compare a cluster without changes and another with your change side-by-side. Which leads us to the next feature.

## Dev workflow support

kube-spawn makes testing changes to Kubernetes really easy. You just need to build your Hyperkube Docker image with a particular `VERSION` tag. Once that’s built, you need to start kube-spawn with the `--dev` flag, and set `--hyperkube-tag` to the same name you used when building the Hyperkube image.

Taking advantage of the aforementioned multi-cluster support, you can build current Kubernetes master, start a cluster with `--cluster-name=master`, build Kubernetes your patch, and start another cluster with `--cluster-name=fix`. You’ll now have two clusters to check how your patch behaves in comparison with an unpatched Kubernetes.

You can find a detailed step-by-step example of this in [kube-spawn’s documentation](https://github.com/kinvolk/kube-spawn/blob/v0.2.1/doc/dev-workflow.md).

## kube-spawn, a certified Kubernetes distribution

<img src="/media/certified_kubernetes.svg" class="ml-3 rounded float-right" width=150 alt="certified kubernetes">

We’ve successfully run the [Kubernetes Software Conformance Certification tests](https://github.com/cncf/k8s-conformance) based on [Sonobuoy](https://github.com/heptio/sonobuoy) for Kubernetes v1.7 and v1.8. We’ve [submitted](https://github.com/cncf/k8s-conformance/pull/98) [the results](https://github.com/cncf/k8s-conformance/pull/99) to CNCF and they merged our PRs. This means kube-spawn is now a [certified Kubernetes distribution](https://docs.google.com/spreadsheets/d/1LxSqBzjOxfGx3cmtZ4EbB_BGCxT_wlxW_xgHVVa23es).

<div class="clearfix" ></div>

## Conclusion

With the above additions, we feel like kube-spawn is one of the best tools for developing on Linux with, and on, Kubernetes.

If you want to try it out, we've just released [kube-spawn v0.2.1](https://github.com/kinvolk/kube-spawn/releases/tag/v0.2.1). We look forward to your feedback and welcome issues or PRs on the [Github project](https://github.com/kinvolk/kube-spawn).
