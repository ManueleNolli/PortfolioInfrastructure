# Portfolio - CDK Infrastructure

This project contains the *Infrastructure as Code* for my [Portfolio](../Portfolio) website https://www.manuelenolli.ch, using the [AWS Cloud Development Kit (CDK)](https://aws.amazon.com/cdk/).

This is the successor to [PersonalWebsiteAws](https://github.com/ManueleNolli/PersonalWebsiteAws): the frontend is now a static Vite SPA with no server-side rendering, so there is no SSR Lambda in this stack - CloudFront serves everything straight from S3, with only `/mail` and `/github` forwarded to API Gateway.

## Requirements

* node: 20.16.0
* yarn: 1.22.22

## Installation and Usage

```bash
yarn install
```

```bash
yarn deploy:first # will create the S3 buckets
```

Once the Portfolio frontend is built and pushed to the assets S3 bucket (just execute the GitHub Action in the Portfolio repo), you can deploy the rest:
```bash
yarn deploy
```

## AWS Infrastructure

The website is hosted on AWS using the following services:
* [Amazon S3](https://aws.amazon.com/s3/): static hosting for the built SPA (and the code bucket for the two Lambda artifacts)
* [AWS Lambda](https://aws.amazon.com/lambda/): the mail (SES) and GitHub-repos-fetch services only - no SSR Lambda
* [Amazon API Gateway](https://aws.amazon.com/api-gateway/): routes `/mail` and `/github` to their Lambdas
* [Amazon CloudFront](https://aws.amazon.com/cloudfront/): CDN in front of S3, with `/mail`/`/github` forwarded to API Gateway and a custom-error-response SPA fallback (403/404 → `/index.html`) so client-side routes work on direct navigation
* [Amazon Route 53](https://aws.amazon.com/route53/)*: domain name management
* [Amazon Certificate Manager](https://aws.amazon.com/certificate-manager/)*: SSL certificates
* [Amazon WAF](https://aws.amazon.com/waf/)*: web application firewall

\* These services are not implemented in this project, the CDK stack creates up to the CloudFront distribution; the additional services are customisable and configured manually. I personally followed this [Developer Guide](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/routing-to-cloudfront-distribution.html).

## Must do manually

As mentioned above, some services are not implemented in this project. If you want to deploy the infrastructure as I did, you need to follow these steps:
1. Create your domain in Route 53 as a Hosted Zone (you should configure the NS records in your domain provider)
2. Create a certificate in ACM for your domain (you should validate the certificate by adding a CNAME record in Route 53), then set its ARN as `cloudfront_certificate_arn` in `bin/iac.ts`
3. Enable WAF in CloudFront and configure the rules as you wish
4. Configure the domain in CloudFront:
   1. Add the domain in the Alternate Domain Names (CNAMEs) field. For example `*.manuelenolli.ch` and `manuelenolli.ch`
   2. Add the certificate in the SSL Certificate field
