+++
authors = ["Lorenzo Manacorda"]
date = "2017-12-06T12:00:00-06:00"
title = "Get started with Habitat on Kubernetes"
description = ""
draft = false
tags = ["habitat", "containers", "kubernetes"]
topics = ["Containers", "Kubernetes", "Habitat"]
postImage =  "get-started-with-habitat-on-Kubernetes.png"
+++

[Habitat](https://www.habitat.sh/) is a project that aims to solve the problem of building, deploying and managing services. We at Kinvolk have been working on Kubernetes integration for Habitat in cooperation with Chef. This integration comes in the form of a Kubernetes controller called Habitat operator. The Habitat operator allows cluster administrators to fully utilize Habitat features inside their Kubernetes clusters, all the while maintaining high compatibility with the “Kubernetes way” of doing things. For more details about Habitat and the Habitat operator have a look at [our introductory blog post](https://kinvolk.io/blog/2017/10/habitat-operator---running-habitat-services-with-kubernetes/).

In this guide we will explain how to use the Habitat operator to run and manage a Habitat-packaged application in a Kubernetes cluster on Google Kubernetes Engine (GKE). This guide assumes a basic understanding of Kubernetes.

We will deploy a [simple web application](https://github.com/kinvolk/habitat-demo-counter.rb) which displays the number of times the page has been accessed.

## Prerequisites

We’re going to assume some initial setup is done. For example, you’ll need to have created an account on [Google Cloud Platform](https://cloud.google.com) and have already installed and configured the [Google Cloud SDK](https://cloud.google.com/sdk/docs/) as well as its [`beta` component](https://cloud.google.com/sdk/docs/managing-components#installing_components). Lastly, you’ll want to [download kubectl](https://kubernetes.io/docs/tasks/tools/install-kubectl/) so you can connect to the cluster.

## Creating a cluster

To start, we’ll want to create a project on GCP to contain the cluster and all related settings. Project names are unique on GCP, so use one of your choosing in the following commands.

Create it with:

```bash
$ gcloud projects create habitat-on-kubernetes
```

We will then need to enable the "compute API" for the project we’ve just created. This API allows us to create clusters and containers.

```bash
$ gcloud service-management enable container.googleapis.com --project habitat-on-kubernetes
```

We also need to enable billing for our project, since we’re going to spin up some nodes in a cluster:

```bash
$ gcloud beta billing projects link hab-foobar --billing-account=$your-billing-id
```

Now we’re ready to create the cluster. We will have to choose a name and a zone in which the cluster will reside. You can list existing zones with:

```bash
$ gcloud compute zones list --project habitat-on-kubernetes
```

This following command sets the zone to "europe-west1-b" and the name to "habitat-cluster". This command can take several minutes to complete.

```bash
$ gcloud container clusters create habitat-demo-cluster --project habitat-on-kubernetes --zone europe-west1-b
```

## Deploying the operator

The next step is to deploy the Habitat operator. This is a component that runs in your cluster, and reacts to the creation and deletion of Habitat Custom Objects by creating, updating or deleting resources in the cluster. Like all objects, operators are deployed with a yaml manifest file. The contents of the manifest file are shown below:.

```yaml
apiVersion: extensions/v1beta1
kind: Deployment
metadata:
  name: habitat-operator
spec:
  replicas: 1
  template:
    metadata:
      labels:
        name: habitat-operator
    spec:
      containers:
      - name: habitat-operator
        image: kinvolk/habitat-operator:v0.2.0
```

From the root of our demo application, we can then deploy the operator with:

```bash
kubectl create -f kubernetes/habitat-operator.yml
```

## Deploying the demo application

With that done, we can finally deploy our demo application:

```yaml
apiVersion: habitat.sh/v1
kind: Habitat
metadata:
  name: habitat-demo-counter
spec:
  image: kinvolk/habitat-demo-counter
  count: 1
  service:
    topology: standalone
---
apiVersion: v1
kind: Service
metadata:
  name: front
spec:
  selector:
    habitat-name: habitat-demo-counter
  type: LoadBalancer
  ports:
  - name: web
    targetPort: 8000
    port: 8000
    protocol: TCP
```

Just run the following command:

```bash
$ kubectl create -f kubernetes/habitat-demo-counter.yml
```

We can monitor the status of our deployment with `kubectl get pod -w`. Once all pods are in the “Running” state, our application is fully deployed and ready to interact with.

Let’s find out the public IP address of our application by running `kubectl get services front`.
The IP will be listed under the column “External IP”.

Let’s test it out by going to the service’s IP and port 8000, where we should see the app’s landing page, with the view counter. The counter increases every time we refresh the page, and can be reset with the “Reset” button.

To see this in action, watch the video below.

{{< youtube AJm31JOhrNI >}}

The Ruby web application has been [packaged with Habitat](https://github.com/kinvolk/habitat-demo-counter.rb/blob/master/habitat/plan.sh), and is now running as a Habitat service in a Docker container deployed on Kubernetes. Congratulations!
