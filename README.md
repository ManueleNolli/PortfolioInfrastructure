# Portfolio - CDK Infrastructure

This project contains the *Infrastructure as Code* for my [Portfolio](https://github.com/ManueleNolli/Portfolio) website https://www.manuelenolli.ch, using the [AWS Cloud Development Kit (CDK)](https://aws.amazon.com/cdk/) in TypeScript.

It replaces the former [PersonalWebsiteAws](https://github.com/ManueleNolli/PersonalWebsiteAws), which also ran a server-side rendering Lambda. The website is now a static single-page app, so CloudFront serves it straight from S3 and only the backend APIs go through Lambda.

## Architecture

```
                         ┌──> S3 assets bucket (static site)
 viewer ──> CloudFront ──┤
                         └──> API Gateway ──┬──> POST /mail   ──> mail Lambda ──> SES
                              (/mail,       └──> GET  /github ──> GitHub Lambda
                               /github)
```

The stack (`PortfolioStack`) creates:

* [Amazon S3](https://aws.amazon.com/s3/):
  * **assets bucket**: the built website, uploaded by the [Portfolio](https://github.com/ManueleNolli/Portfolio) CI/CD
  * **code bucket**: code and dependencies zips of the two Lambdas, uploaded by their repositories' CI/CD
* [AWS Lambda](https://aws.amazon.com/lambda/):
  * **mail Lambda** (code from [AwsLambdaSimpleEmailService](https://github.com/ManueleNolli/AwsLambdaSimpleEmailService)): sends the contact form emails through [Amazon SES](https://aws.amazon.com/ses/)
  * **GitHub Lambda** (code from [AwsLambdaGithubRepositoriesService](https://github.com/ManueleNolli/AwsLambdaGithubRepositoriesService)): fetches my public GitHub repositories
* [Amazon API Gateway](https://aws.amazon.com/api-gateway/) (HTTP API): routes `POST /mail` and `GET /github` to their Lambdas
* [Amazon CloudFront](https://aws.amazon.com/cloudfront/):
  * default behavior, `/assets/*`, `robots.txt` and `sitemap.xml` are served from the assets bucket (cached)
  * `/mail` and `/github` are forwarded to API Gateway (not cached)
  * SPA fallback: 403/404 responses return `/index.html`, so client-side routes (e.g. `/hobbies/mixology`) work on direct navigation or refresh

The configuration (bucket, Lambda, API and distribution names, domain, certificate ARN) is in `bin/iac.ts`.

## Requirements

* node: 20.x or later
* yarn: 1.22.22
* AWS credentials for the target account, and the account [bootstrapped for CDK](https://docs.aws.amazon.com/cdk/v2/guide/bootstrapping.html) (`npx cdk bootstrap`)

## Installation and Usage

```bash
yarn install
```

| Script              | Purpose                                                       |
|---------------------|---------------------------------------------------------------|
| `yarn deploy:first` | Deploy only the two S3 buckets (first deploy)                 |
| `yarn diff`         | Show the changes `yarn deploy` would make                     |
| `yarn deploy`       | Deploy the full stack, including the mail and GitHub services |
| `yarn test`         | Jest tests on the synthesized template                        |

Always use `yarn diff` / `yarn deploy` instead of plain `cdk diff` / `cdk deploy`: the mail and GitHub services are only included when the `MAIL_SERVICE=true` and `GITHUB_FETCH_SERVICE=true` environment variables are set, which these scripts do. Without them, a deploy would delete both Lambdas.

### First deploy

The Lambdas are created from zips in the code bucket, so the buckets must exist and be filled before the rest of the stack:

1. `yarn deploy:first`: creates the two S3 buckets.
2. Run the GitHub Actions of [AwsLambdaSimpleEmailService](https://github.com/ManueleNolli/AwsLambdaSimpleEmailService) and [AwsLambdaGithubRepositoriesService](https://github.com/ManueleNolli/AwsLambdaGithubRepositoriesService): they upload the Lambda zips to the code bucket.
3. `yarn deploy`: creates the Lambdas, API Gateway and CloudFront.
4. Run the GitHub Action of [Portfolio](https://github.com/ManueleNolli/Portfolio): it uploads the website to the assets bucket and invalidates CloudFront.

## Configured manually

These parts are not managed by this stack and are set up once in the AWS console.

### Domain and certificate

1. Create the domain's hosted zone in Route 53 and point the domain's NS records at it.
2. Request a certificate in ACM in **us-east-1** (required by CloudFront) for `manuelenolli.ch` and `*.manuelenolli.ch`, validate it with the CNAME record in Route 53, and set its ARN as `cloudfront_certificate_arn` in `bin/iac.ts`.
3. After the first full deploy, create an alias `A` record in Route 53 pointing the domain to the CloudFront distribution (its domain is in the `CloudFrontDomain` stack output). See the [Developer Guide](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/routing-to-cloudfront-distribution.html).

The domain's email (MX and SPF records) is also managed in Route 53, outside this stack.

### SES

Verify the sender identity (domain or address) used by the mail Lambda in Amazon SES.

### GitHub Actions access (OIDC)

The CI/CD of the three repositories deploys to AWS with [GitHub OIDC](https://docs.github.com/en/actions/security-for-github-actions/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services) instead of access keys:

1. IAM → Identity providers: add an OpenID Connect provider with URL `https://token.actions.githubusercontent.com` and audience `sts.amazonaws.com`.
2. IAM → Roles: create one role for web identity, trusted only for the `main` branch of the three repositories. GitHub includes the owner and repository IDs in the token subject, e.g. `repo:ManueleNolli@<owner id>/Portfolio@<repository id>:ref:refs/heads/main`.
3. Give the role an inline policy limited to what the pipelines do: write to the assets bucket and invalidate the distribution, upload the Lambda zips to the code bucket, and update the two Lambdas and their layers.
4. Set the role ARN as the `AWS_ROLE_ARN` repository variable in each repository.

## Tests

The tests in `test/` synthesize the stack and check its template: first deploy creates only the buckets, the full deploy has the two services, the `/mail` and `/github` routes and the SPA fallback, and services are skipped when their flags are off.

`yarn build` compiles `.js` files next to the `.ts` sources, and Jest would load those instead of the sources. They are gitignored; delete them (`rm lib/*.js lib/*.d.ts bin/*.js bin/*.d.ts`) if you built before running the tests.
