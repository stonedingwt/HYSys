FROM python:3.10-slim

ENV PATH="${PATH}:/root/.local/bin"
ENV PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple
ENV UV_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple

WORKDIR /app

# 安装系统依赖 + pandoc + ffmpeg
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    gcc g++ curl build-essential libreoffice \
    wget procps vim fonts-wqy-zenhei patch \
    libglib2.0-0 libsm6 libxrender1 libxext6 libgl1 \
    ffmpeg pandoc \
    && rm -rf /var/lib/apt/lists/*

# 安装 uv
RUN pip install uv -i https://pypi.tuna.tsinghua.edu.cn/simple

# 拷贝项目依赖文件
COPY ./pyproject.toml ./uv.lock ./

# 安装 Python 依赖
# 1. 从 pyproject.toml 中去除已被 PyPI 下架的私有包
# 2. 用 uv 解析并安装其余依赖
# 3. 单独安装替代私有包（pyautogen 不加 deps 避免 numpy 冲突）
RUN python -m pip install --upgrade pip && \
    sed -i '/mep_pyautogen/d' pyproject.toml && \
    sed -i '/mep-ragas/d' pyproject.toml && \
    sed -i '/ibm-db/d' pyproject.toml && \
    uv pip compile pyproject.toml --output-file requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple && \
    uv pip install -r requirements.txt --system --no-cache-dir && \
    pip install pyautogen==0.3.2 --no-deps && \
    pip install diskcache flaml termcolor docker && \
    pip install ragas==0.2.12 --no-deps && \
    python -c "import site,os,pathlib; sp=site.getsitepackages()[0]; \
      src=pathlib.Path(sp)/'ragas'; dst=pathlib.Path(sp)/'mep_ragas'; \
      os.symlink(src, dst) if not dst.exists() and src.exists() else None; \
      print(f'Created mep_ragas symlink')" && \
    uv cache clean

# 安装 NLTK 数据 (允许失败)
RUN python -c "import nltk; nltk.download('punkt'); nltk.download('punkt_tab'); nltk.download('averaged_perceptron_tagger'); nltk.download('averaged_perceptron_tagger_eng')" || true

# 安装 playwright chromium (允许失败)
RUN (playwright install chromium && playwright install-deps) || true

COPY . .

CMD ["sh", "entrypoint.sh"]
