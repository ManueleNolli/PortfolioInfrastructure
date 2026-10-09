import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as cloudfrontOrigin from "aws-cdk-lib/aws-cloudfront-origins";
import * as acm from 'aws-cdk-lib/aws-certificatemanager';

import {Construct} from 'constructs'
import {HttpApi} from "aws-cdk-lib/aws-apigatewayv2";
import {MailService} from "./mailService";
import {GithubService} from "./githubService";

type StackProps = cdk.StackProps & {
    isFirstDeploy: boolean,
    isMailService: boolean,
    isGithubFetchService: boolean,
    s3_bucket_code_name: string,
    s3_bucket_assets_name: string,
    lambda_mail_name: string,
    lambda_mail_layer_name: string,
    lambda_mail_code_file_name: string,
    lambda_mail_layer_file_name: string,
    lambda_mail_handler: string,
    lambda_github_name: string,
    lambda_github_layer_name: string,
    lambda_github_code_file_name: string,
    lambda_github_layer_file_name: string,
    lambda_github_handler: string,
    apigateway_lambda_integration_name: string,
    apigateway_name: string,
    cloudfront_name: string,
    cloudfront_domain: string,
    cloudfront_certificate_arn: string
}

// Serves the static Vite SPA build from S3 behind CloudFront. There is no
// SSR Lambda: every page route is a static file, and only /mail and /github
// are forwarded past CloudFront to the shared API Gateway (mail + github
// Lambdas, wired up by MailService/GithubService below).
export class PortfolioStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: StackProps) {
        super(scope, id, props);

        /********************************************************
         *********************** BUCKETS ************************
         ********************************************************/
        const codeBucket = new s3.Bucket(this, props.s3_bucket_code_name, {
            bucketName: props.s3_bucket_code_name,
            removalPolicy: cdk.RemovalPolicy.DESTROY, // Used to delete the bucket when the stack is deleted
            autoDeleteObjects: true // Used to delete the objects in the bucket when the stack is deleted
        });

        const assetsBucket = new s3.Bucket(this, props.s3_bucket_assets_name, {
            bucketName: props.s3_bucket_assets_name,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true
        });

        // If it is the first deploy it is necessary to upload the zip files by the other project (via actions)
        if (props.isFirstDeploy)
            return

        /********************************************************
         *********************** API GATEWAY ********************
         ********************************************************/

        // Routes are added by MailService/GithubService below; there is no
        // catch-all route here since there's no SSR Lambda to proxy to.
        const apiGateway = new HttpApi(this, props.apigateway_name)

        /********************************************************
         *********************** CLOUD FRONT ******************
         ********************************************************/

        const assetsOrigin = cloudfrontOrigin.S3BucketOrigin.withOriginAccessControl(assetsBucket)
        const serverOrigin = new cloudfrontOrigin.HttpOrigin(`${apiGateway.apiId}.execute-api.${this.region}.amazonaws.com`)

        const cloudFront = new cloudfront.Distribution(this, props.cloudfront_name, {
            defaultBehavior: {
                origin: assetsOrigin,
                allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED
            },
            domainNames: [props.cloudfront_domain, `*.${props.cloudfront_domain}`],
            certificate: props.cloudfront_certificate_arn ? acm.Certificate.fromCertificateArn(this, 'Certificate', props.cloudfront_certificate_arn) : undefined,
            additionalBehaviors: {
                '/assets/*': {
                    origin: assetsOrigin,
                    allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
                    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED
                },
                'robots.txt': {
                    origin: assetsOrigin,
                    allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
                    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED
                },
                'sitemap.xml': {
                    origin: assetsOrigin,
                    allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
                    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED
                },
                // These two no longer reach API Gateway via an SSR Lambda's
                // internal routing, so they need explicit behaviors.
                '/mail': {
                    origin: serverOrigin,
                    allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
                    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
                    originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER
                },
                '/github': {
                    origin: serverOrigin,
                    allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
                    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
                    originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER
                }
            },
            // SPA fallback: client-side routes (e.g. /hobbies/mixology) are not
            // real S3 keys, so a direct nav/refresh 404s at S3 - serve index.html
            // instead and let react-router take over.
            errorResponses: [
                {httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html'},
                {httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html'}
            ]
        });

        /********************************************************
         *********************** MAIL SERVICE ******************
         ********************************************************/

        if (props.isMailService)
            new MailService(
                {
                    stack: this,
                    lambda_mail_layer_name: props.lambda_mail_layer_name,
                    lambda_mail_layer_file_name: props.lambda_mail_layer_file_name,
                    lambda_mail_name: props.lambda_mail_name,
                    lambda_mail_code_file_name: props.lambda_mail_code_file_name,
                    lambda_mail_handler: props.lambda_mail_handler,
                    codeBucket,
                    apigateway_lambda_integration_name: props.apigateway_lambda_integration_name,
                    apiGateway
                }
            )

        /********************************************************
         *********************** GITHUB SERVICE ******************
         ********************************************************/

        if (props.isGithubFetchService)
            new GithubService(
                {
                    stack: this,
                    lambda_github_layer_name: props.lambda_github_layer_name,
                    lambda_github_layer_file_name: props.lambda_github_layer_file_name,
                    lambda_github_name: props.lambda_github_name,
                    lambda_github_code_file_name: props.lambda_github_code_file_name,
                    lambda_github_handler: props.lambda_github_handler,
                    codeBucket,
                    apigateway_lambda_integration_name: props.apigateway_lambda_integration_name,
                    apiGateway
                }
            )


        /********************************************************
         ********************* OUTPUTS **************************
         ********************************************************/

        new cdk.CfnOutput(this, 'CloudFrontDomain', {
            value: cloudFront.distributionDomainName,
            description: 'CloudFront Domain'
        });
    }
}
