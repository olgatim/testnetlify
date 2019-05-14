+++
authors = ["Zeeshan Ali"]
date = "2017-12-05T11:00:00-06:00"
title = "Introducing the Habitat Kubernetes Exporter"
description = ""
draft = false
tags = ["habitat", "containers", "kubernetes", "docker"]
topics = ["Containers", "Kubernetes", "Habitat"]
postImage =  "article-hero.jpg"
+++

At [Kinvolk](https://kinvolk.io), we've been working with the [Habitat](https://www.habitat.sh/) team at [Chef](https://chef.io) to make Habitat-packaged applications run well in Kubernetes.

The first step on this journey was the [Habitat operator](https://github.com/kinvolk/habitat-operator) for Kubernetes which my colleague, Lili, [already wrote about](https://kinvolk.io/blog/2017/10/habitat-operator---running-habitat-services-with-kubernetes/). The second part of this project&nbsp;&mdash;the focus of this post&mdash;&nbsp;is to make it easier to deploy Habitat apps to a Kubernetes cluster that is running the Habitat operator.

## Exporting to Kubernetes

To that end, we'd like to introduce the Habitat Kubernetes exporter.

The Kubernetes exporter is an additional command line subcommand to the standard Habitat CLI interface. It leverages the existing Docker image export functionality and, additionally, generates a Kubernetes manifest that can be deployed to a Kubernetes cluster running the Habitat operator.

The command line for the Kubernetes exporter is:

```bash
$ hab pkg export kubernetes ORIGIN/NAME
```

Run `hab pkg export kubernetes --help` to see the full list of available options and general help.

## Demo

Let's take a look at the Habitat Kubernetes exporter in action.

{{< youtube Dj7Nt1JpgKM>}}

As you can see, the Habitat Kubernetes exporter helps you to deploy your applications that are built and packaged with Habitat on a Kubernetes cluster by generating the needed manifest files.

## More to come

We've got more exciting ideas for making Habitat and Habitat Builder work even more seamlessly with Kubernetes. So stay tuned for more.
