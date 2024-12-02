const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const crypto = require('crypto');
const app = express();
const port = 7777;

// 配置 multer，用于处理 multipart/form-data
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // 设置上传目录
  },
  filename: (req, file, cb) => {
    // 获取文件原始后缀
    let ext = path.extname(file.originalname);
    if (ext == '.sil') {
      ext = '.mp3';
    }
    // 自定义文件名
    const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, filename);
  },
});

const upload = multer({
  storage, fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.sil'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      console.log('拦截非 sil 文件，不保存:', file.originalname);
      cb(null, false);
    }
  },
});

// 语音识别 API 配置
const lfasr_host = 'https://raasr.xfyun.cn/v2/api';
const api_upload = '/upload';
const api_get_result = '/getResult';

// 获取签名
function getSigna(appid, secret_key, ts) {
  const md5 = crypto.createHash('md5').update(appid + ts).digest('hex');
  const signa = crypto.createHmac('sha1', secret_key)
    .update(md5)
    .digest('base64');
  return signa;
}

// 解析文字
function extractTextFromLattice(orderResult) {
  try {
    const lattice = JSON.parse(orderResult).lattice;
    return lattice.map(item => {
      const jsonData = JSON.parse(item.json_1best);
      const result = jsonData.st.rt
        .flatMap(rtItem => rtItem.ws)
        .flatMap(wsItem => wsItem.cw)
        .map(cwItem => cwItem.w)
        .join('');
      return result;
    }).join('');
  } catch (error) {
    console.log('解析文字错误', error);
    return '';
  }
}

// 上传文件到讯飞接口
async function uploadFileToIxfy(appid, secret_key, filePath) {
  const ts = Math.floor(Date.now() / 1000).toString();
  const signa = getSigna(appid, secret_key, ts);
  const file_len = fs.statSync(filePath).size;
  const file_name = path.basename(filePath);

  const param_dict = {
    appId: appid,
    signa: signa,
    ts: ts,
    fileSize: file_len,
    fileName: file_name,
    duration: '200',
  };

  const data = fs.readFileSync(filePath);

  try {
    const response = await axios.post(
      `${lfasr_host}${api_upload}?${new URLSearchParams(param_dict).toString()}`,
      data,
      { headers: { 'Content-Type': 'application/json' } }
    );
    return response.data;
  } catch (error) {
    console.error("Error uploading file:", error);
    return null;
  }
}

// 查询语音识别结果
async function getResultFromIxfy(appid, secret_key, orderId) {
  const ts = Math.floor(Date.now() / 1000).toString();
  const signa = getSigna(appid, secret_key, ts);

  const param_dict = {
    appId: appid,
    signa: signa,
    ts: ts,
    orderId: orderId,
    resultType: 'transfer',
  };

  let status = 3;
  while (status === 3) {
    try {
      const response = await axios.post(
        `${lfasr_host}${api_get_result}?${new URLSearchParams(param_dict).toString()}`,
        {},
        { headers: { 'Content-Type': 'application/json' } }
      );
      status = response.data.content.orderInfo.status;
      console.log("Status:", status);
      if (status === 4) {
        return extractTextFromLattice(response.data.content.orderResult);
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error("Error getting result:", error);
      break;
    }
  }
  return null;
}

// 收消息 API 路由
app.post('/api/receive-message', upload.single('content'), async (req, res) => {
  try {
    const { type, source, isMentioned, isMsgFromSelf } = req.body;

    // 从请求中提取信息
    console.log('消息类型:', type);
    console.log('消息内容:', req.file ? req.file.path : req.body.content);
    console.log('消息来源:', source);
    console.log('@我的消息:', isMentioned === '1');
    console.log('是否来自自己:', isMsgFromSelf === '1');

    // 处理不同类型的消息
    switch (type) {
      case 'text':
        console.log('文本消息:', req.body.content);
        break;
      case 'file':
        if (!req.file) break;
        console.log('文件消息路径:', req.file.path);
        if (path.extname(req.file.path) === '.mp3') {
          // 如果是 MP3 文件，调用语音识别 API
          const appid = 'c91956d5';
          const secret_key = '14d27e2a3bd6275208e1638d0f02640e';

          // 上传文件并获取 orderId
          const uploadResp = await uploadFileToIxfy(appid, secret_key, req.file.path);
          if (uploadResp && uploadResp.content && uploadResp.content.orderId) {
            const orderId = uploadResp.content.orderId;
            // 查询识别结果
            const result = await getResultFromIxfy(appid, secret_key, orderId);
            if (result) {
              console.log('识别结果:', result);
              return res.json({
                success: true,
                message: '语音转换成功',
                asrText: result, // 返回转换后的文字
              });
            }
          }
        }
        break;
      case 'urlLink':
        console.log('链接卡片:', req.body.content);
        break;
      case 'friendship':
        console.log('好友邀请:', req.body.content);
        break;
      case 'system_event_login':
        console.log('系统登录事件');
        break;
      case 'system_event_logout':
        console.log('系统登出事件');
        break;
      default:
        console.log('未知类型消息:', type);
        break;
    }

    // 返回处理结果
    res.json({
      success: true,
      message: '消息已成功接收并处理',
    });
  } catch (error) {
    console.error('处理消息时出错:', error);
    res.status(500).json({
      success: false,
      message: '服务器处理消息时出错',
    });
  }
});

// 启动服务器
app.listen(port, () => {
  console.log(`服务器运行在 http://localhost:${port}`);
});
