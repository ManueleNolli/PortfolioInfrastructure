#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import {PortfolioStack} from "../lib/portfolioStack";

const app = new cdk.App();

const stackConfig = {
    isFirstDeploy: process.env.FIRST_DEPLOY === 'true', // It will create only the buckets
    isMailService: process.env.MAIL_SERVICE === 'true', // It will create lambda for mail service
    isGithubFetchService: process.env.GITHUB_FETCH_SERVICE === 'true', // It will create lambda for github fetch service
    /* S3 Buckets */
    s3_bucket_code_name: 'portfolio-code-bucket',
    s3_bucket_assets_name: 'portfolio-static-assets-bucket',

    /* Lambda Mail with SES */
    lambda_mail_name: 'portfolio-mail-lambda',
    lambda_mail_layer_name: 'portfolio-mail-dependencies-layer',
    lambda_mail_code_file_name: 'codeMail.zip',
    lambda_mail_layer_file_name: 'dependenciesMail.zip',
    lambda_mail_handler: 'index.handler',

    /* Lambda Fetch Github repositories */
    lambda_github_name: 'portfolio-github-lambda',
    lambda_github_layer_name: 'portfolio-github-dependencies-layer',
    lambda_github_code_file_name: 'codeGithub.zip',
    lambda_github_layer_file_name: 'dependenciesGithub.zip',
    lambda_github_handler: 'index.handler',

    /* API Gateway */
    apigateway_lambda_integration_name: 'portfolio-apigateway-lambda-integration',
    apigateway_name: 'portfolio-apigateway',

    /* Cloudfront */
    cloudfront_name: 'portfolio-cloudfront',
    cloudfront_domain: 'manuelenolli.ch',
    cloudfront_certificate_arn: 'arn:aws:acm:us-east-1:307946635128:certificate/e6d17bc3-1a2e-4936-980b-0449da40e7d7' // ACM certificate ARN for the domain
}

const stack = new PortfolioStack(app, 'PortfolioStack', stackConfig);
cdk.Tags.of(stack).add('project', 'portfolio');
