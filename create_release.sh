#!/bin/bash
# Create GitHub Release v1.0.2 for AIKeyVault
# Run this from the project root directory

TOKEN=$(echo -e "protocol=https\nhost=github.com\n" | git credential fill 2>/dev/null | grep "^password=" | cut -d= -f2)

if [ -z "$TOKEN" ]; then
  echo "Failed to get GitHub token"
  exit 1
fi

curl -s -X POST "https://api.github.com/repos/Awfp1314/AIKeyVault/releases" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -d '{
    "tag_name": "v1.0.2",
    "target_commitish": "main",
    "name": "v1.0.2",
    "body": "- 新增更新检查，Dashboard 打开自动检查\n- 发现新版本弹窗提醒，可跳转下载\n- 新增版本对比展示和 Release Notes",
    "draft": false,
    "prerelease": false
  }'

echo ""
echo "Release created!"
