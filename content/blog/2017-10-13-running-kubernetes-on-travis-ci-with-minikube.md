+++
authors = ["Lili Cosic"]
date = "2017-10-13T10:30:00+02:00"
description = ""
draft = false
tags = ["ci", "habitat", "kubernetes", "minikube"]
title = "Running Kubernetes on Travis CI with minikube"
topics = ["Habitat", "Testing", "Kubernetes"]
postImage =  "minikube-on-travis-blog.png"

+++

It is not easily possible to run Kubernetes on [Travis CI](https://travis-ci.com/), as most methods of setting up a cluster need to create resources on AWS, or another cloud provider. And setting up VMs is also not possible as Travis CI doesn't allow nested virtualization. This post explains how to use minikube without additional resources, with a few simple steps.

# Our use case

As we are currently working with [Chef](https://www.chef.io/) on a project to integrate [Habitat](https://www.habitat.sh/) with Kubernetes([Habitat Operator](https://github.com/kinvolk/habitat-operator)), we needed a way to run the end-to-end tests on every pull request. Locally we use [minikube](https://github.com/kubernetes/minikube), a tool to setup a local one-node Kubernetes cluster for development, or when we need a multi-node cluster, [kube-spawn](https://github.com/kinvolk/kube-spawn/). But for automated CI tests we only currently require a single node setup. So we decided to use minikube to be able to easily catch any failed tests and debug and reproduce those locally.

Typically minikube requires a virtual machine to setup Kubernetes. One day [this tweet](https://twitter.com/rothgar/status/892430879426977793) was shared in our Slack. It seems that minikube has a not-so-well-documented way of running Kubernetes with no need for virtualization as it sets up `localkube`, a single binary for kubernetes that is executed in a Docker container and Travis CI already has Docker support. There is a warning against running this locally, but since we only use it on Travis CI, in an ephemeral environment, we concluded that this is an acceptable use case.

# The setup

So this is what our setup looks like. Following is the example `.travis.yml` file:

```yaml
sudo: required

env:
- CHANGE_MINIKUBE_NONE_USER=true

before_script:
- curl -Lo kubectl https://storage.googleapis.com/kubernetes-release/release/v1.7.0/bin/linux/amd64/kubectl && chmod +x kubectl && sudo mv kubectl /usr/local/bin/
- curl -Lo minikube https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64 && chmod +x minikube && sudo mv minikube /usr/local/bin/
- sudo minikube start --vm-driver=none --kubernetes-version=v1.7.0
- minikube update-context
- JSONPATH='{range .items[*]}{@.metadata.name}:{range @.status.conditions[*]}{@.type}={@.status};{end}{end}'; until kubectl get nodes -o jsonpath="$JSONPATH" 2>&1 | grep -q "Ready=True"; do sleep 1; done
```

## How it works

First, it installs `kubectl`, which is a requirement of minikube. The need for `sudo: required` comes from minikube’s starting processes, which requires to be `root`. Having set the enviorment variable `CHANGE_MINIKUBE_NONE_USER`, minikube will automatically move config files to the appropriate place as well as adjust the permissions respectively. When using the `none` driver, the `kubectl` config and credentials generated will be owned by `root` and will appear in the `root` user's home directory. The `none` driver then does the heavy lifting of setting up `localkube` on the host. Then the `kubeconfig` is updated with `minikube update-context`. And lastly we wait for Kubernetes to be up and ready.

## Examples

This work is already being used in the [Habitat Operator](https://github.com/kinvolk/habitat-operator). For a simple live example setup have a look at [this repo](https://github.com/LiliC/travis-minikube). If you have any questions feel free to ping me on twitter [@LiliCosic](https://twitter.com/LiliCosic).

Follow [Kinvolk on twitter](https://twitter.com/kinvolkio) to get notified when new blog posts go live.
