import logging
import os
import re
import sys
from itertools import product

import anytree
from flask import Flask, abort, jsonify, request
from flask_cors import CORS
from fuzzywuzzy import fuzz

import verible_verilog_syntax

app = Flask(__name__)
CORS(app)

logger = logging.getLogger("werkzeug")  # grabs underlying WSGI logger
handler = logging.FileHandler("test.log")  # creates handler for the log file
logger.addHandler(handler)


def replace_relative_path(base, offset=""):
    if offset != "":
        path = os.path.join(base, offset)
    else:
        path = base
    path = re.sub(r"\/.\/\/", "//", path)  # /path/./aaa -> /path//a
    path = re.sub(r"\/+", "/", path)  # /path///aa//b -> /path/a/b
    while re.search(r"\w+\/\.\.\/", path):
        path = re.sub(r"\w+\/\.\.\/", "", path)  # /path/aa/../b -> /path/b
    return path


def replace_env_var(path):
    def get_env(match):
        return os.getenv(match.group(1))

    path = re.sub(r"\$(\w+)", get_env, path)
    return path


def process_list(lst):
    file_list = []
    lst = lst.strip()
    lst = replace_relative_path(replace_env_var(lst))
    with open(lst, "r") as handle:
        for line in handle:
            line = re.sub(r"\/\/.*", "", line)
            if line != "":
                re0 = re.match(r"\+incdir\+(.*)", line)
                re1 = re.match(r"\-f\s+(.*)", line)
                re2 = re.match(r"-v", line)
                re3 = re.match(r"-y", line)
                if re0:
                    path = replace_relative_path(replace_env_var(re0.group(1)))
                    file_list.append(path)
                elif re1:
                    path = replace_relative_path(replace_env_var(re1.group(1)))
                    file_list.extend(process_list(path))
                elif not re2 and not re3:
                    path = line.strip()
                    path = replace_relative_path(replace_env_var(path))
                    file_list.append(path)
    return file_list


def process_file_data(path: str, data: verible_verilog_syntax.SyntaxData):
    """Print information about modules found in SystemVerilog file.

    This function uses verible_verilog_syntax.Node methods to find module
    declarations and specific tokens containing following information:

    * module name
    * module port names
    * module parameter names
    * module imports
    * module header code

    Args:
      path: Path to source file (used only for informational purposes)
      data: Parsing results returned by one of VeribleVerilogSyntax' parse_*
            methods.
    """
    if not data.tree:
        return

    modules_info = []

    # Collect information about each module declaration in the file
    for module in data.tree.iter_find_all({"tag": "kModuleDeclaration"}):
        module_info = {
            "header_text": "",
            "name": "",
            "ports": [],
            "direct": [],
            "parameters": [],
            "imports": [],
        }

        # Find module header
        header = module.find({"tag": "kModuleHeader"})
        if not header:
            continue
        module_info["header_text"] = header.text

        # Find module name
        name = header.find(
            {"tag": ["SymbolIdentifier", "EscapedIdentifier"]},
            iter_=anytree.PreOrderIter,
        )
        if not name:
            continue
        module_info["name"] = name.text

        # Get the list of ports
        for port in header.iter_find_all({"tag": ["kPortDeclaration", "kPort"]}):
            port_direct = port.find({"tag": ["input", "output"]})
            port_id = port.find({"tag": ["SymbolIdentifier", "EscapedIdentifier"]})
            module_info["ports"].append(port_id.text)
            if port_direct is None:
                module_info["direct"].append(module_info["direct"][-1])
            else:
                module_info["direct"].append(port_direct.text)

        # Get the list of parameters
        for param in header.iter_find_all({"tag": ["kParamDeclaration"]}):
            param_id = param.find({"tag": ["SymbolIdentifier", "EscapedIdentifier"]})
            module_info["parameters"].append(param_id.text)

        # Get the list of imports
        for pkg in module.iter_find_all({"tag": ["kPackageImportItem"]}):
            module_info["imports"].append(pkg.text)

        modules_info.append(module_info)

    def print_entry(key, values):
        logger.info(key + " : " + str(values))

    for module_info in modules_info:
        print_entry("name:       ", [module_info["name"]])
        print_entry("ports:      ", module_info["ports"])
        print_entry("direct:     ", module_info["direct"])
        print_entry("parameters: ", module_info["parameters"])

    return modules_info


def parser_hdl(files):
    parser = verible_verilog_syntax.VeribleVerilogSyntax(
        executable="./verible-verilog-syntax"
    )
    data = parser.parse_files(files)
    logger.info(data)
    modules_info_parser = []

    for file_path, file_data in data.items():
        module_info_parser = process_file_data(file_path, file_data)
        modules_info_parser.extend(module_info_parser)

    return modules_info_parser


@app.route("/process_file", methods=["POST"])
def process_file():
    # 从请求中获取文件路径
    logger.info(request.json)
    file_path = request.json.get("input")

    if not file_path:
        abort(400, description="未提供文件路径。")

    # 这里可以添加文件处理逻辑，例如读取文件内容等
    # 假设我们只是检查文件是否存在
    if os.path.exists(file_path):
        filelist = process_list(file_path)
        logger.info(filelist)
        modules_info_parser = parser_hdl(filelist)
        modules_info_react = []
        items = []
        for item in modules_info_parser:
            logger.info(item)
            module_info_react = {}
            module_info_react["name"] = item["name"]
            module_info_react["param"] = item["parameters"]
            module_info_react["input"] = []
            module_info_react["output"] = []
            for ports in item["ports"]:
                direct = item["direct"].pop(0)
                if direct == "input":
                    module_info_react["input"].append(ports)
                else:
                    module_info_react["output"].append(ports)
            modules_info_react.append(module_info_react)
        for item in modules_info_react:
            item_module = dict()
            item_module["type"] = item["name"]
            item_module["name"] = item["name"]
            item_module["color"] = "rgb(192,0,255)"
            items.append(item_module)
        logger.info(modules_info_react)
        logger.info(items)
        response_data = {
            "status": "success",
            "message": f"File Exist, Parser Done",
            "modules_info": modules_info_react,
            "items": items,
        }
    else:
        response_data = {"status": "error", "message": f"File {file_path} Not Exist"}

    # 返回JSON响应
    return jsonify(response_data)


def find_best_matches(list1, list2):
    # 创建一个字典来存储每个元素的匹配结果
    matches = {s: (None, 0) for s in list1}  # {元素: (匹配的元素, 匹配度)}

    # 尝试所有可能的配对组合
    for s1, s2 in product(list1, list2):
        # 计算当前配对的匹配度
        current_score = fuzz.ratio(s1, s2)
        # 如果当前配对的匹配度高于当前元素的最好匹配度，则更新匹配结果
        if current_score > matches[s1][1]:
            matches[s1] = (s2, current_score)

    # 将匹配结果转换为列表
    best_matches = [(s1, match[0], match[1]) for s1, match in matches.items()]

    # 按匹配度从高到低排序
    best_matches.sort(key=lambda x: x[2], reverse=True)

    return best_matches


@app.route("/process_connect", methods=["POST"])
def process_connect():
    logger.info(request.json)
    src_output_port = []
    dst_input_port = []
    components = request.json
    for component in components:
        x = component["x"]
        output_ports = [port["label"] for port in component["ports"] if not port["in"]]
        input_ports = [port["label"] for port in component["ports"] if port["in"]]

        if x <= min((c["x"] for c in components)):
            src_output_port.extend(output_ports)
        elif x >= max((c["x"] for c in components)):
            dst_input_port.extend(input_ports)

    logger.info(src_output_port)
    logger.info(dst_input_port)

    best_matches = find_best_matches(src_output_port, dst_input_port)
    for match in best_matches:
        logger.info(f"Match: {match[0]} <-> {match[1]} with score: {match[2]}")

    response_data = {
        "status": "success",
        "message": "Auto Connect Finish",
        "connect_info": "",
    }
    return jsonify(response_data)


if __name__ == "__main__":
    app.run(debug=True)
