FROM dataelement/mep-backend:base.v8

WORKDIR /app

COPY ./ ./

# 生成并安装依赖（移除私有包和ibm-db，使用清华源）
RUN sed -i '/mep_pyautogen/d' pyproject.toml && \
    sed -i '/mep-ragas/d' pyproject.toml && \
    sed -i '/ibm-db/d' pyproject.toml && \
    uv pip compile pyproject.toml --upgrade --output-file requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple && \
    uv pip install -r requirements.txt --system --no-cache-dir && \
    uv cache clean && \
    rm -f requirements.txt

# patch langchain-openai lib. remove this when langchain-openai support reasoning_content
RUN patch -p1 < /app/mep/patches/langchain_openai.patch /usr/local/lib/python3.10/site-packages/langchain_openai/chat_models/base.py || true

# patch nest_asyncio to be uvloop-safe globally
RUN sed -i "s/raise ValueError.*Can.*patch loop.*type.*/return  # skip unsupported loop type/" /usr/local/lib/python3.10/site-packages/nest_asyncio.py && echo "Patched nest_asyncio" || true


CMD ["sh", "entrypoint.sh"]
