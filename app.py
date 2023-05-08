# -*- coding: utf-8 -*-
"""
Time:     2023/4/28 14:56
Author:   Jyun
Version:  V 1.0
File:     app.py
Blog:     https://ctrlcv.blog.csdn.net
"""

import json
import os
# import re
import shutil
import time
import uuid
from urllib.parse import quote
from flask_httpauth import HTTPBasicAuth  # pip install flask_httpauth
from flask import Flask, Response, render_template, request, jsonify

# from jinja2 import FileSystemLoader, ChoiceLoader

app = Flask(__name__)
app.config['JSON_AS_ASCII'] = False
auth = HTTPBasicAuth()

USER_LIST = [('root', 'root.123')]  # 用户列表

# 添加额外的Jinja2模板搜索路径
app.jinja_loader.searchpath.append('./static/option-svg')

RELATIVE_PATH = 'FILES'
BASE_DIR = os.path.abspath(RELATIVE_PATH)  # 用于浏览的文件夹

SHARE_DICT = {}

try:
    with open(os.path.abspath('./users.json'), 'r', encoding='utf8') as u:
        USER_LIST.extend(json.loads(u.read()))
except FileNotFoundError:
    pass


class Tools:
    @staticmethod
    def size_convert(value):  # 文件大小 单位转换
        units = ["B", "KB", "MB", "GB", "TB", "PB"]
        size = 1024.0
        for i in range(len(units)):
            if (value / size) < 1:
                return "%.2f %s" % (value, units[i])
            value = value / size

    @staticmethod
    def getsize(path):
        if os.path.isfile(path):
            size_b = os.path.getsize(path)
            return Tools.size_convert(size_b)
        return '-'

    @staticmethod
    def getmtime(path):
        ctime = os.path.getmtime(path)
        return time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(ctime))

    @staticmethod
    def gettype(path):
        if os.path.isdir(path):
            return '文件夹'
        return os.path.splitext(path)[1].upper().strip('.') + '文件'

    @staticmethod
    def search_folder(folder_path, target_name):
        results = []  # 存储搜索结果的列表
        for file_name in os.listdir(folder_path):  # 遍历文件夹中的每个文件和文件夹
            full_path = os.path.join(folder_path, file_name)  # 获取完整路径
            if os.path.isdir(full_path):  # 如果是文件夹
                if target_name in file_name:  # 如果名称包含目标名称
                    results.append(os.path.join(*Tools.split_file_path(full_path)[1:]))  # 将相对路径添加到结果列表中
                else:  # 否则递归搜索子文件夹
                    results.extend(Tools.search_folder(full_path, target_name))
            elif os.path.isfile(full_path) and target_name in file_name:  # 如果是文件且名称包含目标名称
                results.append(os.path.join(*Tools.split_file_path(full_path)[1:]))  # 将相对路径添加到结果列表中
        return results

    @staticmethod
    def split_file_path(file_path):
        """
        将文件路径分割成列表
        :param file_path: 文件路径
        :return: 包含每一级文件夹名称和最后一个文件或文件夹名称的列表
        """
        path_parts = []
        while True:
            file_path, folder = os.path.split(file_path)
            if folder != "":
                path_parts.append(folder)
            else:
                if file_path != "":
                    path_parts.append(file_path)
                break
        path_parts.reverse()
        return path_parts

    @staticmethod
    def file_response(path):
        def send_chunk():  # 流式读取
            with open(path, 'rb') as target_file:
                while True:
                    chunk = target_file.read(20 * 1024 * 1024)  # 每次读取20M
                    if not chunk:
                        break
                    yield chunk

        filename = quote(os.path.basename(path).encode("utf-8"))
        response = Response(send_chunk(), content_type='application/octet-stream')
        response.headers["Content-Disposition"] = f'attachment; filename={filename}'
        response.headers["Content-Length"] = str(os.path.getsize(path))
        return response

    @staticmethod
    def dir_response(files_list, abs_path=BASE_DIR, index_of=dict({})):
        dir_content = []
        for relative_path in files_list:
            final_path = os.path.join(abs_path, relative_path)
            href = relative_path + '/' if os.path.isdir(final_path) else relative_path
            if '.chunk/' in href or '.chunk\\' in href:
                continue
            dir_content.append({
                'href': href,
                'type': Tools.gettype(final_path),
                'size': Tools.getsize(final_path),
                'modify_time': Tools.getmtime(final_path)
            })
        dir_content.sort(key=lambda x: x["modify_time"], reverse=True)

        return render_template('index.html', dir_content=dir_content, index_of=index_of)


@app.route('/share', methods=['POST'])
@app.route('/share/<string:shareid>')
def share_links(shareid=None):
    if request.method == 'GET':
        path = SHARE_DICT.get(shareid)  # 根据分享id获取文件路径
        if path:
            if os.path.isfile(path):
                return Tools.file_response(path)
            del SHARE_DICT[shareid]
        return 'Link has expired'

    else:
        # 返回下载链接
        data = request.json
        file_path = os.path.join(BASE_DIR, data['dir'].strip('/'), data['file'])
        for k, v in SHARE_DICT.items():  # 遍历字典查找是否已经分享过
            if v == file_path:
                return jsonify({'shareid': k})

        shareid = uuid.uuid1().hex
        SHARE_DICT[shareid] = file_path

        return jsonify({'shareid': shareid})


@app.route('/')
@app.route('/<path:_index_path>')
@auth.login_required
def file_view(_index_path=''):
    abs_path = os.path.join(BASE_DIR, os.path.join(*_index_path.split('/')))

    if request.args.get('opt') == 'newfolder':  # 新建文件夹
        os.makedirs(abs_path)
        return 'ok'
    search_key = request.args.get('search')
    if search_key:  # 搜索
        index_of = {f'搜索:{search_key}': f'?search={search_key}'}
        return Tools.dir_response(Tools.search_folder(RELATIVE_PATH, search_key), index_of=index_of)

    if os.path.isdir(abs_path):  # 判断请求路径是否为文件夹
        _index_list = _index_path.strip('/').split('/')
        index_of = {v: '/'.join(_index_list[:i + 1]) + '/' for i, v in enumerate(_index_list) if v}
        return Tools.dir_response(os.listdir(abs_path), abs_path, index_of)

    if os.path.isfile(abs_path):
        return Tools.file_response(abs_path)

    return '404 Not Found'


@auth.verify_password
def verify_password(username, password):
    for user, pwd in USER_LIST:  # 简单直接 用户密码验证
        if username == user and password == pwd:
            return True
    return False


@app.route('/upload', methods=['POST'])
def upload():
    file = request.files['file']  # 获取分片数据
    chunk = int(request.form['chunk'])  # 获取分片序号
    total_chunks = int(request.form['totalChunks'])  # 获取分片总数
    filename = request.form['filename']  # 获取文件名
    filedir = request.form['dir'].strip('/')

    upload_folder = os.path.join(BASE_DIR, filedir)  # 指定上传文件的目录
    # upload_folder = '/path/to/upload/folder'  # 指定上传文件的目录
    if not os.path.exists(upload_folder):
        os.makedirs(upload_folder)

    chunk_folder = os.path.join(upload_folder, '.chunk', filename)  # 指定当前文件的分片所在目录
    if not os.path.exists(chunk_folder):
        os.makedirs(chunk_folder)

    chunk_filename = os.path.join(chunk_folder, f'{chunk}.chunk')  # 构造当前分片的文件名
    file.save(chunk_filename)  # 将分片数据保存到文件中

    if chunk == total_chunks - 1:
        # 所有分片都已上传，开始合并文件
        with open(os.path.join(upload_folder, filename), 'wb') as output_file:
            for i in range(total_chunks):
                chunk_filename = os.path.join(chunk_folder, f'{i}.chunk')  # 获取每个分片的文件名
                with open(chunk_filename, 'rb') as input_file:
                    output_file.write(input_file.read())  # 将每个分片的数据写入到输出文件中

        # 合并完成后，删除分片所在目录
        shutil.rmtree(chunk_folder)

    return jsonify({'message': 'Chunk uploaded successfully'})


@app.route('/delete', methods=['POST'])
def delete():
    file = request.json['file']  # 获取文件名,也有可能是文件夹名
    filedir = request.json['dir'].strip('/')
    path = os.path.join(BASE_DIR, filedir, file)

    if not os.path.exists(path):
        return 'Unable to find the specified file or folder'
    elif os.path.isdir(path):
        shutil.rmtree(path)
    elif os.path.isfile(path):
        os.remove(path)
    return 'ok'


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8020, debug=True)
