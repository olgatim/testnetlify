+++
authors = ["Indradhanush Gupta"]
date = "2017-12-07T16:00:00-06:00"
title = "Automated Build to Kubernetes with Habitat Builder"
description = "Learn how to automatically build and stage app containers and use Habitat to promote to production"
draft = false
tags = ["habitat", "builder", "containers", "kubernetes"]
topics = ["Containers", "Kubernetes", "Habitat"]
postImage =  "automated-build-to-kubernetes-with-habitat-builder.png"
+++

## Introduction

Imagine a set of tools which allows you to not only build your codebase automatically each time you apply new changes but also to deploy to a cluster for testing, provided the build is successful. Once the smoke tests pass or the QA team gives the go ahead, the same artifact can be automatically deployed to production.

In this blog post we talk about such an experimental pipeline that we’ve built using [Habitat Builder](https://www.habitat.sh/) and [Kubernetes](https://kubernetes.io/). But first, let’s look at the building blocks.

## What is Habitat and Habitat Builder?

Habitat is a tool by [Chef](https://www.chef.io/) that allows one to automate the deployment of applications. It allows developers to package their application for multiple environments like a container runtime or a VM.

One of Habitat’s components is Builder. It uses a `plan.sh` file, which is part of the application codebase, to build a Habitat package out of it. A `plan.sh` file for Habitat is similar to what a `Dockerfile` is to `Docker`, and like Docker, it outputs a Habitat artifact that has a `.hart` extension.

Habitat also has a concept called channels which are similar to tags. By default, a successful build is tagged under the `unstable` channel and users can use the concept of promotion to promote a specific build of a package to a different channel like `stable`, `staging` or `production`. Users can choose channel names for themselves and use the `hab pkg promote` command to promote a package to a specific channel.

Please check out the [tutorials](https://www.habitat.sh/tutorials) on the Habitat site for a more in-depth introduction to Habitat.


## Habitat ❤ Kubernetes

Kubernetes is a platform that runs containerized applications and supports container scheduling, orchestration, and service discovery. Thus, while Kubernetes does the infrastructure management, Habitat manages the application packaging and deployment.

We will take a look at the available tools that help us integrate Habitat in a functioning Kubernetes cluster.

### Habitat Operator

A Kubernetes Operator is an abstraction that takes care of running a more complex piece of software. It leverages the Kubernetes API, and manages and configures the application by hiding the complexities away from the end user. This allows a user to be able to focus on using the application for their purposes instead of dealing with deployment and configuration themselves. The [Kinvolk](https://kinvolk.io) team built a Habitat Operator with exactly these goals in mind.


### Habitat Kubernetes Exporter

Recently, a new exporter was added to Habitat by the Kinvolk team that helps in integrating Habitat with Kubernetes. It creates and uploads a Docker image to a Docker registry, and returns a manifest that can be applied with `kubectl`. The output manifest file can be specified as a command line argument and it also accepts a custom Docker registry URL. [This blog post](https://kinvolk.io/blog/2017/12/introducing-the-habitat-kubernetes-exporter/) covers this topic in more depth along with a demo at the end.

## Automating Kubernetes Export

Today we are excited to show you a demo of a fully automated Habitat Builder to Kubernetes pipeline that we are currently working on together with the Habitat folks:

{{< youtube FkNOhduuh_I >}}

The video shows a private Habitat Builder instance re-building the `it-works` project, exporting a Docker image to Docker Hub and automatically deploying it to a local Kubernetes cluster through the Habitat Operator. Last but not leat, the service is promoted from unstable to testing automatically.

In the future, Kubernetes integration will allow you to set up not only seamless, automated deploys but also bring Habitat’s service promotion to services running in Kubernetes. Stay tuned!

If you want to follow our work (or set up the prototype yourself), you can find a detailed README [here](https://github.com/kinvolk/habitat-builder-to-kubernetes/blob/master/README.md).

## Conclusion

This is an exciting start to how both Habitat and Kubernetes can complement each other. If you are at [KubeCon](http://events.linuxfoundation.org/events/kubecon-and-cloudnativecon-north-america), stop by at the Habitat or Kinvolk booth to chat about Habitat and Kubernetes. You can also find us on the [Habitat slack](https://habitat-sh.slack.com/) in the `#general` or `#kubernetes` channels.
