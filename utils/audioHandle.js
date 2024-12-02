// 讯飞语音转写处理
const fs = require('fs');
const axios = require('axios');
const crypto = require('crypto');
const path = require('path');
const lfasr_host = 'https://raasr.xfyun.cn/v2/api';
const api_upload = '/upload';
const api_get_result = '/getResult';
const appid = 'c91956d5';
const secret_key = '14d27e2a3bd6275208e1638d0f02640e';

// 获取签名
function getSigna(ts) {
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
async function uploadFileToIxfy(filePath) {
  const ts = Math.floor(Date.now() / 1000).toString();
  const signa = getSigna(ts);
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
  console.log(param_dict)
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
async function getResultFromIxfy(orderId) {
  const ts = Math.floor(Date.now() / 1000).toString();
  const signa = getSigna(ts);

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

module.exports = {
  uploadFileToIxfy,
  getResultFromIxfy,
}