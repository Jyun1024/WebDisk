/*
* time:     2023/4/28 14:58
* author:   Jyun
* version:  V 0.1
* file:     index.js
* blog:     https://ctrlcv.blog.csdn.net
* */

const container = document.querySelector('#container');// 获取拖动上传区域
// const uploadDiv = document.getElementById("upload-div");
const searchForm = document.getElementById('search-form');
const searchInput = searchForm.querySelector('input');
const uploadInput = document.getElementById("upload-input");
const filesList = document.querySelector('#container table tbody');// 获取文件列表区域
const netStatusNode = document.getElementById('net-status');// 获取网速显示text
const allLinks = document.querySelectorAll('a');
const trList = document.querySelectorAll('tr.dir'); // 选择所有文件夹 tr 元素


const CHUNK_SIZE = 1024 * 1024; // 每个分片的大小，这里设置为1MB

let WORKLOAD = 0
let NOW_ITEM

// 遍历所有 a 标签，为其添加点击事件监听器
allLinks.forEach(link => {
    link.addEventListener('click', function (event) {
        // 根据指定条件判断是否阻止跳转
        if (WORKLOAD) {
            // if (!confirm("此操作会打断正在进行的任务，是否继续？")) {
            event.preventDefault(); // 阻止默认跳转行为
            // }

        }
    });
});


trList.forEach(function (tr) { // 遍历每个 tr 元素
    tr.addEventListener('click', function () {
        if (!WORKLOAD) {
            window.location.href = this.getAttribute('data-item');
        }
    });
});


// 文件搜索
searchForm.addEventListener("submit", (e) => {
    const formData = new FormData(searchForm);
    if (!formData.get('search')) {
        e.preventDefault()
        searchInput.focus()
    }
});

// 文件上传 START
document.addEventListener('paste', (e) => { // 粘贴事件
    const fileList = e.clipboardData.files;
    for (const file of fileList) {
        WORKLOAD++
        CreateFileElement(file)
    }
})


uploadInput.addEventListener("change", () => {  // 选择文件后触发
    const file = uploadInput.files[0];
    if (!file) return
    console.log(file);
    WORKLOAD++
    CreateFileElement(file)
});


container.addEventListener('dragenter', (e) => { // 拖入时触发
    if (e.dataTransfer.types.includes('Files')) {
        container.classList.add('hover');
        e.preventDefault();
    }
})

container.addEventListener('dragover', (e) => {  // 当元素正在被拖动时持续触发。
    if (e.dataTransfer.types.includes('Files')) {
        container.classList.add('hover');
        e.preventDefault();
    }
})

container.addEventListener('dragleave', (e) => {  // 当元素被拖出时触发。
    container.classList.remove('hover');
})
container.addEventListener('drop', (e) => {
    container.classList.remove('hover');
    e.preventDefault();
    for (const item of e.dataTransfer.items) {
        const entry = item.webkitGetAsEntry();
        if (!entry) continue
        if (entry.isDirectory) {
            // 目录
            const reader = entry.createReader();
            reader.readEntries((en) => {
                console.log(en);
                alert('暂不支持上传文件夹')
            });
        } else {
            // 文件
            entry.file((f) => {
                WORKLOAD++
                console.log(f);
                // uploadFile(f)
                CreateFileElement(f)
            });
        }
    }
})
// 文件上传 END

// 文件移动 START
const filesTbody = document.getElementById('files-tbody')
const filesPathDiv = document.getElementById('location')
filesTbody.ondragstart = (e) => {
    e.dataTransfer.effectAllowed = 'move'
    NOW_ITEM = e.target.dataset.item
}
filesPathDiv.ondragstart = (e) => {
    e.dataTransfer.effectAllowed = 'move'
    NOW_ITEM = e.target.dataset.item
}

filesTbody.ondragover = (e) => {
    e.preventDefault()
}
filesPathDiv.ondragover = (e) => {
    e.preventDefault()
}

filesTbody.ondrop = (e) => {
    const tr = e.target.closest('tr')
    if (tr.dataset.drop && NOW_ITEM) {
        console.log('move', NOW_ITEM, 'to', tr.dataset.item)
        moveFile(NOW_ITEM, tr.dataset.item)
    }
}

filesPathDiv.ondrop = (e) => {
    console.log('move', NOW_ITEM, 'to', e.target.getAttribute('href'))
    if (NOW_ITEM && e.target.getAttribute('href')) {
        moveFile(NOW_ITEM, '', e.target.getAttribute('href'))
    }
}
// 文件移动 END

navigator.connection.addEventListener('change', updateNetworkStatus)  // 监听网络状态变化
setInterval(updateNetworkStatus, 10000)  // 每10秒更新一次网络状况

function CreateFileElement(file) {
    // 向tbody中插入一个新的tr元素，并将其插入到顶部
    let newRow = filesList.insertRow(0);

    // 为新的tr元素添加CSS样式
    // newRow.style.border = '2px dashed #7e7e76'
    newRow.style.background = '#bebebb'
    // newRow.style.boxShadow = '0px 0px 4px 0px rgb(126, 126, 118)'

    // 在新的tr元素中插入两个新的td元素
    newRow.insertCell().innerHTML = `<div><img class="file-svg" src="/static/option-svg/file.svg">&nbsp;${file.name}</div>`
    // newRow.insertCell().textContent = `${file.name}`;
    newRow.insertCell().textContent = `${file.name.split(".").pop().toUpperCase()}文件`;
    newRow.insertCell().textContent = formatSize(file.size);
    newRow.insertCell().textContent = file.lastModifiedDate.toJSON().replace('T', ' ').substring(0, 19);
    // newRow.insertCell().textContent = file.lastModifiedDate.toLocaleString().replaceAll('/', '-');
    let optionCell = newRow.insertCell()

    let uploadBtn = document.createElement('a')
    // uploadBtn.text = '开始上传'
    uploadBtn.innerText = '开始上传'
    // uploadBtn.innerHTML = '<img class="upload-svg" src="/static/option-svg/upload.svg">'
    uploadBtn.classList.add('option')
    uploadBtn.classList.add('upload-btn')
    uploadBtn.href = "javascript:void(0)"
    uploadBtn.onclick = () => {
        // console.log('上传文件')
        uploadFile(file, updateProgress)
        uploadBtn.onclick = null
        uploadBtn.text = '上传中'
        // uploadBtn.classList.remove('btn-upload', 'btn')
        uploadBtn.classList.add('netspeed-text')
    }
    optionCell.appendChild(uploadBtn)

    function updateProgress(progress, netspeed = 0) {
        newRow.style.background = `linear-gradient(to right, #fff 0%, #fff ${progress * 100}%, #bebebb ${progress * 100}%, #bebebb 100%)`
        uploadBtn.text = `上传中 ${formatSize(netspeed)}/s`
        if (progress === 1) { // 上传完毕
            uploadBtn.innerHTML = '<img src="/static/option-svg/upload-sucess.svg">'
            newRow.style.cssText = null;
        }
    }
}


function uploadFile(file, updateProgress) {
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE); // 计算文件需要分成多少个分片
    let currentChunk = 0; // 当前上传的分片序号
    let uploadedBytes = 0; // 已上传的字节数

    function sendChunk(retries = 0) {
        const formData = new FormData();
        const startByte = currentChunk * CHUNK_SIZE; // 当前分片在文件中的起始字节位置
        const endByte = Math.min((currentChunk + 1) * CHUNK_SIZE, file.size); // 当前分片在文件中的结束字节位置
        const chunk = file.slice(startByte, endByte); // 获取当前分片的二进制数据
        let historyBytes = 0  // history
        let historyTime = new Date().getTime()  // history


        // 将分片数据和相关信息添加到表单数据中
        formData.append('file', chunk);
        formData.append('dir', decodeURIComponent(window.location.pathname));
        formData.append('chunk', currentChunk.toString());
        formData.append('totalChunks', totalChunks.toString());
        formData.append('filename', file.name);


        // 使用XMLHttpRequest向服务器发送分片数据
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/upload', true);

        // 监听上传进度事件
        xhr.upload.addEventListener('progress', event => {
            const {loaded, total} = event;  // {当前块累计已上传的大小, 当前块的大小}
            // console.log({loaded, total})
            const nowUploadedBytes = loaded - historyBytes  // 本次上传字节数
            uploadedBytes += nowUploadedBytes; // 累计已上传的字节数+=当前块累计已上传的大小-上次当前块累计已上传的大小
            const progress = uploadedBytes / file.size; // 计算上传进度
            // console.log(`${uploadedBytes} / ${file.size}`)
            // console.log(progress)
            historyBytes = loaded
            // 计算网速
            const nowtime = new Date().getTime();
            // 每次上传的字节数÷((当前时间-上次时间=每次的时间差ms)÷1000=s)=每秒网速
            const netspeed = nowUploadedBytes / ((nowtime - historyTime) / 1000)
            historyTime = nowtime
            updateProgress(progress, netspeed);
            // netspeedNode.textContent = formatSize(netspeed)
        });

        xhr.onload = () => {
            if (xhr.status === 200) {
                console.log(xhr.responseText)
                currentChunk++;
                if (currentChunk < totalChunks) {
                    sendChunk(); // 如果还有分片未上传，则继续上传
                } else {
                    // 所有分片上传完成
                    updateProgress(1);
                    WORKLOAD--
                    if (!WORKLOAD) location.reload();
                }
            }
        };

        xhr.onerror = error => {
            console.error(error);
            retry(retries + 1);
        };

        xhr.send(formData);
    }

    function retry(retries) {
        if (retries < 30) {
            console.log(`Retrying... (${retries + 1})`);
            setTimeout(() => sendChunk(retries), 3000);
        } else {
            console.error('Maximum number of retries reached.');
        }
    }

    sendChunk(); // 开始上传第一个分片
}

function deleteItem(link) {
    const itemId = link.getAttribute('data-item-id');
    const confirmDelete = confirm(`你确定要删除 ${itemId}?`);

    if (confirmDelete) {
        // 执行删除操作
        console.log(`Deletion action performed on item ${itemId}.`);
        let xhr = new XMLHttpRequest();
        xhr.open("POST", '/delete', true);
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4 && xhr.status === 200) {
                // 处理响应结果
                console.log(xhr.responseText);
                if (xhr.responseText === 'ok') {
                    location.reload();
                } else {
                    alert('删除失败')
                }
            }
        };
        xhr.send(JSON.stringify({
            'file': itemId,
            'dir': decodeURIComponent(window.location.pathname)
        }));

    }
}

function mkdir() {
    let dirname = prompt("新建文件夹");
    if (dirname) {
        fetch(`${dirname}?opt=newfolder`).then((resp) => resp.text()).then((msg) => {
            if (msg === 'ok') location.reload()
        });
    }
}

function moveFile(file, toDir, path = '') {
    const f = window.location.pathname + file
    const dir = toDir ? window.location.pathname + toDir : path

    fetch(`?opt=move&file=${f}&to=${dir}`).then((resp) => resp.text()).then((msg) => {
        if (msg === 'ok') location.reload()
    });

}

function getShareLink(item) {
    let itemId = item.getAttribute('data-item-id')
    fetch('/share', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            'file': itemId,
            'dir': decodeURIComponent(window.location.pathname)
        })
    }).then(response => response.json()).then(data => {
        const shareLink = `${window.location.origin}/share/${data.shareid}`
        const text = prompt(`${itemId}\n点击确定 复制分享链接 `, shareLink)
        if (text) {
            copyText(text)
        }
    }).catch(error => console.error(error));


}

function formatSize(b) {
    if (b < 1024) {
        return b.toFixed(2) + " B";
    } else if (b < 1048576) {
        return (b / 1024).toFixed(2) + " KB";
    } else if (b < 1073741824) {
        return (b / 1048576).toFixed(2) + " MB";
    } else {
        return (b / 1073741824).toFixed(2) + " GB";
    }
}


function copyText(text) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
}


function getNetworkInfo() {
    let info;
    if (navigator.onLine) {
        info = {
            type: navigator.connection.effectiveType,
            rtt: navigator.connection.rtt,
            downlink: navigator.connection.downlink,
        };
    } else {
        info = {
            type: 'offline',
            rtt: 0,
            downlink: 0,
        };
    }
    return info;
}

function updateNetworkStatus() {
    let networkType = netStatusNode.children[0]
    let networkSpeed = netStatusNode.children[1]
    let networkRtt = netStatusNode.children[2]
    let networkInfo = getNetworkInfo()
    networkType.textContent = networkInfo.type.toUpperCase()
    networkSpeed.textContent = `⇅ ${networkInfo.downlink}Mb/s`
    networkRtt.textContent = `RTT：${networkInfo.rtt}ms`
}

