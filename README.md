# 农场变异查看器

一个用于解析农场协议数据、查看土地变异情况的工具。

## 功能特性

- ✅ HEX 数据解析
- ✅ 剪贴板自动读取与解析
- ✅ 自动检测 HEX 格式并解析
- ✅ 历史记录管理
- ✅ 变异作物信息展示


## 技术栈

- **后端**: Node.js + Express
- **前端**: EJS + CSS + JavaScript
- **协议解析**: Protocol Buffers

## 环境要求

- Node.js >= 18.0.0
- npm >= 9.0.0

## 安装步骤

```bash
# 克隆项目
git clone <repository-url>
cd wx

# 安装依赖
npm install
```

## 启动方式

### 开发模式

```bash
npm start
```

启动后访问: http://localhost:3000

### 生产模式

```bash
# 安装 pm2 (可选)
npm install -g pm2

# 使用 pm2 启动
pm2 start app.js --name farm-mutant-viewer
```

## 使用说明

1. 启动服务后，浏览器会自动打开
2. 将 HEX 数据粘贴到输入框
3. 点击"解析"按钮或开启"自动解析"开关
4. 系统会自动识别并解析 HEX 数据
5. 查看变异作物信息和统计数据

## 项目结构

```
wx/
├── app.js              # 主应用入口
├── package.json        # 项目依赖配置
├── views/              # 前端模板
│   └── index.ejs       # 主页面
├── proto/              # Protocol Buffers 定义文件
├── gameConfig/         # 游戏配置数据
│   └── Plant.json      # 植物配置
└── history/            # 历史记录目录
    └── history.json    # 历史记录文件
```

## API 接口

| 接口 | 方法 | 描述 |
|------|------|------|
| `/` | GET | 首页 |
| `/parse` | POST | 解析 HEX 数据 |
| `/api/parse` | POST | 解析 HEX 数据 (JSON) |
| `/api/history` | GET | 获取历史记录 |
| `/api/mutation/crops` | GET | 获取变异作物列表 |
| `/api/mutation/calculate?crop=作物名&level=等级` | GET | 计算变异收益 |

## 配置说明

- 默认端口: `3000`
- 历史记录限制: 100 条
- 自动解析: 开启后会自动读取剪贴板内容

## 注意事项

1. 确保端口 3000 未被占用
2. 首次启动需要加载 proto 文件，可能需要几秒时间
3. 历史记录保存在 `history/history.json` 文件中

## Vercel 部署

### 部署步骤

1. **推送代码到 GitHub**

```bash
git add .
git commit -m "Initial commit"
git push -u origin main
```

2. **配置 Vercel**

项目已包含 `vercel.json` 配置文件，Vercel 会自动识别。

3. **部署方式**

- **方式一**: 通过 Vercel Dashboard 导入 GitHub 仓库
- **方式二**: 使用 Vercel CLI

```bash
# 安装 Vercel CLI
npm install -g vercel

# 登录
vercel login

# 部署
vercel --prod
```

### Vercel 配置说明

项目根目录已创建 `vercel.json` 配置文件：

```json
{
  "version": 2,
  "builds": [
    {
      "src": "app.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "app.js"
    }
  ]
}
```

### 注意事项

1. Vercel 部署后端口由平台自动分配，无需手动指定
2. 历史记录功能在 Vercel 上使用可能受限（无持久化存储）
3. 建议部署后测试各项功能是否正常

## License

MIT