# website
The Cloud Native Rejekts website

## Adding content

While one can add content by using the `hugo new` subcommand (shown below), it's preferred to use the [Netlify CMS](https://www.netlifycms.org/) frontend at [https://kinvolk.io/admin](https://kinvolk.io/admin).

The following sections show how to add content from the command line.

### Blog content

In order to add content for the blog you can use the `hugo new` command. The format is as follow.

`hugo new --kind default blog/example-content` 

The following command will create a new blog post with the [front matter](https://gohugo.io/content-management/front-matter/) defined in the default [archetype](https://gohugo.io/content-management/archetypes/) from the `./archetype` directory.

The default front matter almost always needs to be modifed to a category and tags. Here's an example.

```
---
title: "Example Content"
date: 2018-10-26T03:51:27+02:00
draft: true
tags:
- tag1
- tag1
categories:
- Announcement
---
```

## Testing

You should always test your changes locally before creating a pull request. Once you do create a branch or a pull request, we use Netlify to create preview of the changes so that reviewers and yourself can easily review the changes.

### Testing locally

To test locally run the following command.

`hugo server --theme=rejekts --watch --disableFastRender`

The above command will run a server with the the site available at `http://localhost:1313`. It will also watch for any changes made to the site and regenerate and reload the site when changes are detected. In addition, it disables some caching that can sometimes have confusing results.

### Testing Pull requests

Each pull request will run some checks and create a new preview of the changes that can be access by clicking on the Github pull request status section.

### Testing master branch

The site should automatically deploy to [https://priceless-jackson-d459b0.netlify.com/](https://priceless-jackson-d459b0.netlify.com/) when you push to master.
