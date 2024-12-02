const path = require('path');
const { uploadFileToIxfy, getResultFromIxfy } = require('../utils/audioHandle');

// 处理接收到的消息
const handleReceiveMessage = async (req, res) => {
  try {
    const { type, source, isMentioned, isMsgFromSelf } = req.body;
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
          const uploadResp = await uploadFileToIxfy(req.file.path);
          console.log(uploadResp)
          if (uploadResp && uploadResp.content && uploadResp.content.orderId) {
            const orderId = uploadResp.content.orderId;
            // 查询识别结果
            const result = await getResultFromIxfy(orderId);
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
    res.json({
      success: true,
      message: `消息${type}已成功接收并处理`,
    });
  } catch (error) {
    console.error('处理消息时出错:', error);
    res.status(500).json({
      success: false,
      message: '服务器处理消息时出错',
    });
  }
};

module.exports = {
  handleReceiveMessage,
};
