const express = require('express');
const apiRoutes = require('./routes/api');
const app = express();
const port = 7777;

// 中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API 路由
app.use('/api', apiRoutes);

// 启动服务器
app.listen(port, () => {
  console.log(`服务运行成功:http://localhost:${port}`);
});
