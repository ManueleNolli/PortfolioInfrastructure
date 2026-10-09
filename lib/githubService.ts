import * as lambda from "aws-cdk-lib/aws-lambda";
import * as cdk from "aws-cdk-lib";
import {IBucket} from "aws-cdk-lib/aws-s3";
import {HttpLambdaIntegration} from "aws-cdk-lib/aws-apigatewayv2-integrations";
import {HttpApi, HttpMethod} from "aws-cdk-lib/aws-apigatewayv2";

type GithubServiceProps = {
    stack: cdk.Stack,
    lambda_github_layer_name: string,
    lambda_github_layer_file_name: string,
    lambda_github_name: string,
    lambda_github_code_file_name: string,
    lambda_github_handler: string,
    codeBucket: IBucket,
    apigateway_lambda_integration_name: string,
    apiGateway: HttpApi,
}


export class GithubService {

    constructor(props: GithubServiceProps) {

        /********************************************************
         ********************* GITHUB LAMBDA********************
         ********************************************************/
        const lambdaGithubDependenciesLayer = new lambda.LayerVersion(props.stack, props.lambda_github_layer_name, {
            code: lambda.Code.fromBucket(props.codeBucket, props.lambda_github_layer_file_name),
        });

        const githubLambda = new lambda.Function(props.stack, props.lambda_github_name, {
            runtime: lambda.Runtime.NODEJS_20_X,
            code: lambda.Code.fromBucket(props.codeBucket, props.lambda_github_code_file_name), // This code is uploaded just once, if the code changes will need to upload it again
            layers: [lambdaGithubDependenciesLayer],
            handler: props.lambda_github_handler,
            timeout: cdk.Duration.seconds(10),
        });

        /********************************************************
         ********************* API GATEWAY ********************
         ********************************************************/
        props.apiGateway.addRoutes({
            methods: [HttpMethod.GET],
            path: '/github',
            integration: new HttpLambdaIntegration(props.apigateway_lambda_integration_name, githubLambda)
        })
    }
}