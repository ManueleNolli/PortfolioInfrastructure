import * as cdk from 'aws-cdk-lib';
import {Template} from 'aws-cdk-lib/assertions';
import {PortfolioStack} from '../lib/portfolioStack';

const baseProps = {
    isFirstDeploy: false,
    isMailService: true,
    isGithubFetchService: true,
    s3_bucket_code_name: 'portfolio-code-bucket',
    s3_bucket_assets_name: 'portfolio-static-assets-bucket',
    lambda_mail_name: 'portfolio-mail-lambda',
    lambda_mail_layer_name: 'portfolio-mail-dependencies-layer',
    lambda_mail_code_file_name: 'codeMail.zip',
    lambda_mail_layer_file_name: 'dependenciesMail.zip',
    lambda_mail_handler: 'index.handler',
    lambda_github_name: 'portfolio-github-lambda',
    lambda_github_layer_name: 'portfolio-github-dependencies-layer',
    lambda_github_code_file_name: 'codeGithub.zip',
    lambda_github_layer_file_name: 'dependenciesGithub.zip',
    lambda_github_handler: 'index.handler',
    apigateway_lambda_integration_name: 'portfolio-apigateway-lambda-integration',
    apigateway_name: 'portfolio-apigateway',
    cloudfront_name: 'portfolio-cloudfront',
    cloudfront_domain: 'manuelenolli.ch',
    cloudfront_certificate_arn: 'arn:aws:acm:us-east-1:307946635128:certificate/e6d17bc3-1a2e-4936-980b-0449da40e7d7'
};

// Every test here expects one extra AWS::Lambda::Function beyond the
// business Lambdas: CDK's own singleton custom-resource provider for the
// two buckets' `autoDeleteObjects: true`, not application code.

test('first deploy only creates the two S3 buckets', () => {
    const app = new cdk.App();
    const stack = new PortfolioStack(app, 'TestFirstDeployStack', {...baseProps, isFirstDeploy: true});
    const template = Template.fromStack(stack);

    template.resourceCountIs('AWS::S3::Bucket', 2);
    template.resourceCountIs('AWS::Lambda::Function', 1);
    template.resourceCountIs('AWS::CloudFront::Distribution', 0);
});

test('full deploy has no serverless/SSR Lambda, and both services + CloudFront SPA fallback exist', () => {
    const app = new cdk.App();
    const stack = new PortfolioStack(app, 'TestFullDeployStack', baseProps);
    const template = Template.fromStack(stack);

    // The mail + github Lambdas, plus CDK's autoDeleteObjects provider - no SSR/serverless Lambda.
    template.resourceCountIs('AWS::Lambda::Function', 3);

    template.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: {
            CustomErrorResponses: [
                {ErrorCode: 403, ResponseCode: 200, ResponsePagePath: '/index.html'},
                {ErrorCode: 404, ResponseCode: 200, ResponsePagePath: '/index.html'}
            ]
        }
    });

    // /mail and /github routes exist on the shared HTTP API, but no {proxy+} catch-all.
    template.resourceCountIs('AWS::ApiGatewayV2::Route', 2);
    const routes = template.findResources('AWS::ApiGatewayV2::Route');
    const paths = Object.values(routes).map((r: any) => r.Properties.RouteKey);
    expect(paths.some((p: string) => p.includes('{proxy+}'))).toBe(false);
});

test('mail/github services are skipped when their flags are false', () => {
    const app = new cdk.App();
    const stack = new PortfolioStack(app, 'TestNoServicesStack', {
        ...baseProps,
        isMailService: false,
        isGithubFetchService: false
    });
    const template = Template.fromStack(stack);

    template.resourceCountIs('AWS::Lambda::Function', 1);
    template.resourceCountIs('AWS::ApiGatewayV2::Route', 0);
});
