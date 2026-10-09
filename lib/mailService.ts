import * as lambda from "aws-cdk-lib/aws-lambda";
import * as cdk from "aws-cdk-lib";
import * as iam from 'aws-cdk-lib/aws-iam';
import {IBucket} from "aws-cdk-lib/aws-s3";
import {HttpLambdaIntegration} from "aws-cdk-lib/aws-apigatewayv2-integrations";
import {HttpApi, HttpMethod} from "aws-cdk-lib/aws-apigatewayv2";

type MailServiceProps = {
    stack: cdk.Stack,
    lambda_mail_layer_name: string,
    lambda_mail_layer_file_name: string,
    lambda_mail_name: string,
    lambda_mail_code_file_name: string,
    lambda_mail_handler: string,
    codeBucket: IBucket,
    apigateway_lambda_integration_name: string,
    apiGateway: HttpApi,
}


export class MailService {

    constructor(props: MailServiceProps) {

        // SES MUST BE ENABLED IN THE AWS ACCOUNT

        /********************************************************
         ********************* MAIL LAMBDA********************
         ********************************************************/
        const lambdaMailDependenciesLayer = new lambda.LayerVersion(props.stack, props.lambda_mail_layer_name, {
            code: lambda.Code.fromBucket(props.codeBucket, props.lambda_mail_layer_file_name),
        });

        const mailLambda = new lambda.Function(props.stack, props.lambda_mail_name, {
            runtime: lambda.Runtime.NODEJS_20_X,
            code: lambda.Code.fromBucket(props.codeBucket, props.lambda_mail_code_file_name), // This code is uploaded just once, if the code changes will need to upload it again
            layers: [lambdaMailDependenciesLayer],
            handler: props.lambda_mail_handler,
            timeout: cdk.Duration.seconds(10),
        });


        // Grant the Lambda function permission to send emails via SES
        mailLambda.addToRolePolicy(new iam.PolicyStatement({
            actions: ['ses:SendEmail', 'ses:SendRawEmail'],
            resources: ['*'],  // Optionally restrict this to your verified identities
        }));

        /********************************************************
         ********************* API GATEWAY ********************
         ********************************************************/
        props.apiGateway.addRoutes({
            methods: [HttpMethod.POST],
            path: '/mail',
            integration: new HttpLambdaIntegration(props.apigateway_lambda_integration_name, mailLambda)
        })
    }
}