#!/bin/bash
set -xe

export PYTHONPATH="./"

start_mode=${1:-api}

start_paddleocr(){
  echo "Starting PaddleOCR HTTP server on port 8400 (CPU-limited)..."
  export OMP_NUM_THREADS=2
  export MKL_NUM_THREADS=2
  export OPENBLAS_NUM_THREADS=2
  export FLAGS_paddle_num_threads=2
  nice -n 15 python /app/start_paddleocr.py > /tmp/paddleocr.log 2>&1 &
  echo "PaddleOCR HTTP started (PID: $!)"
}

start_knowledge(){
  # 知识库解析的celery worker
    celery -A mep.worker.main worker -l info -c 20 -P threads -Q knowledge_celery -n knowledge@%h
}

start_workflow(){
  # 工作流相关的celery worker。支持多节点运行，但是需要保证各节点的队列名称不冲突且都以workflow_celery开头
    celery -A mep.worker.main worker -l info -c 100 -P threads -Q workflow_celery -n workflow@%h
}

start_beat(){
  # 定时任务调度
    celery -A mep.worker.main beat -l info
}

start_linsight(){
  # 灵境后台任务worker
    python mep/linsight/worker.py --worker_num 4 --max_concurrency 5
}
start_default(){
    # 默认其他任务的执行worker，目前是定时统计埋点数据
    celery -A mep.worker.main worker -l info -c 100 -P threads -Q celery -n celery@%h
}

if [ "$start_mode" = "api" ]; then
    start_paddleocr
    sleep 5
    echo "Starting API server..."
    uvicorn mep.main:app --host 0.0.0.0 --port 7860 --no-access-log --workers 1
elif [ "$start_mode" = "knowledge" ]; then
    echo "Starting Knowledge Celery worker..."
    start_knowledge
elif [ "$start_mode" = "workflow" ]; then
    echo "Starting Workflow Celery worker..."
    start_workflow
elif [ "$start_mode" = "beat" ]; then
    echo "Starting Celery beat..."
    start_beat
elif [ "$start_mode" = "default" ]; then
    echo "Starting default celery worker..."
    start_default
elif [ "$start_mode" = "linsight" ]; then
    echo "Starting LinSight worker..."
    start_linsight
elif [ "$start_mode" = "worker" ]; then
    echo "Starting All worker..."
    # 处理知识库相关任务的worker
    start_knowledge &
    # 处理工作流相关任务的worker
    start_workflow &
    # 处理linsight相关任务的worker
    start_linsight &
    # 默认其他任务的执行worker，目前是定时统计埋点数据
    start_default &
    start_beat

    echo "All workers started successfully."
else
    echo "Invalid start mode. Use api、worker、knowledge、workflow、beat、default、linsight."
    exit 1
fi
