#!/bin/sh
set -eu

bucket="${APEX_DEV_S3_BUCKET:-apex-development-documents}"

if awslocal s3api head-bucket --bucket "$bucket" >/dev/null 2>&1; then
  exit 0
fi

awslocal s3api create-bucket --bucket "$bucket" >/dev/null
