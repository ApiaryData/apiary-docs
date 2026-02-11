---
slug: why-diataxis
title: "Why We Organize Docs with the Diataxis Framework"
authors: [apiarydata]
tags: [documentation, process]
---

Documentation is a product measurement. Apiary organizes its documentation using the [Diataxis framework](https://diataxis.fr/), a systematic approach that separates content by its purpose rather than by topic.

<!-- truncate -->

## The Problem with Topic-Based Docs

Most projects organize documentation by topic: "Storage Engine," "Query Execution," "Deployment." This seems natural, but it creates a problem: each topic page tries to serve multiple audiences at once. A new user looking for setup steps, an experienced user looking for a configuration reference, and an architect evaluating the system all land on the same page and struggle to find what they need.

## Four Kinds of Documentation

Diataxis identifies that documentation serves four distinct purposes, and each requires a different writing style:

**Tutorials** are learning-oriented. They guide a beginner through a series of steps to complete a meaningful project. They are not reference material -- they hold your hand, explain every step, and lead to a specific goal. Our [Your First Apiary](/docs/tutorials/your-first-apiary) tutorial gets you from zero to a working query in 10 minutes.

**How-to Guides** are task-oriented. They assume you already know what you want to accomplish and need practical steps to get there. "How do I deploy on a Raspberry Pi?" is a how-to question -- you know what you want, you just need the steps. No lengthy explanations, just actionable instructions.

**Reference** is information-oriented. It describes APIs, configuration options, and syntax precisely and completely. The [Python SDK Reference](/docs/reference/python-sdk) documents every method with its signature, parameters, return type, and an example. You come here to look things up, not to learn.

**Explanation** is understanding-oriented. It discusses architecture, design decisions, and the reasoning behind choices. Why does Apiary use object storage instead of local-first storage? Why conditional puts instead of Raft? The [Design Decisions](/docs/explanation/design-decisions) page answers these questions.

## How It Maps to Apiary

| I want to... | Section | Example |
|---|---|---|
| Learn Apiary from scratch | Tutorials | [Your First Apiary](/docs/tutorials/your-first-apiary) |
| Deploy on a Raspberry Pi | How-to Guides | [Deploy on Raspberry Pi](/docs/how-to/deploy-raspberry-pi) |
| Look up a Python method | Reference | [Python SDK Reference](/docs/reference/python-sdk) |
| Understand the architecture | Explanation | [Architecture Overview](/docs/explanation/architecture-overview) |

## Why It Matters

Separating these four types of content means each page has a clear audience and purpose. Tutorials don't get cluttered with reference tables. Reference pages don't include lengthy design discussions. How-to guides don't explain why -- they just show how.

The result is documentation that respects your time. New users follow tutorials without drowning in architecture. Experienced users jump straight to reference or how-to content. System architects read the explanation section for design rationale.

We believe documentation quality is as important as code quality. The Diataxis framework gives us a structure to maintain that quality as Apiary evolves.
