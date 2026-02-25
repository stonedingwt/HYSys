"""
MEP Application Entry Point
元境应用入口模块
"""
from contextlib import asynccontextmanager
from typing import Dict, Any, Callable

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, ORJSONResponse
from loguru import logger

from mep.api import router as api_router
from mep.api import router_rpc as rpc_router
from mep.common.errcode import BaseErrorCode
from mep.common.exceptions.auth import AuthJWTException
from mep.common.init_data import init_default_data
from mep.common.services.config_service import settings
from mep.core.context import initialize_app_context, close_app_context
from mep.core.logger import set_logger_config
from mep.services.utils import initialize_services, teardown_services
from mep.utils.http_middleware import CustomMiddleware, WebSocketLoggingMiddleware
from mep.utils.threadpool import thread_pool


class ExceptionHandler:
    """异常处理器类"""
    
    @staticmethod
    def handle_http_error(request: Request, error: Exception) -> ORJSONResponse:
        """处理HTTP异常"""
        if isinstance(error, HTTPException):
            response_data = {
                'status_code': error.status_code,
                'status_message': error.detail['error'] if isinstance(error.detail, dict) else error.detail
            }
        elif isinstance(error, BaseErrorCode):
            error_data = {'exception': str(error), **error.kwargs} if error.kwargs else {'exception': str(error)}
            response_data = {
                'status_code': error.code,
                'status_message': error.message,
                'data': error_data
            }
        else:
            logger.exception('Unhandled exception')
            response_data = {'status_code': 500, 'status_message': str(error)}
        
        logger.error(f'{request.method} {request.url} {str(error)}')
        return ORJSONResponse(content=response_data)
    
    @staticmethod
    def handle_validation_error(request: Request, error: RequestValidationError) -> ORJSONResponse:
        """处理请求验证错误"""
        response_data = {
            'status_code': status.HTTP_422_UNPROCESSABLE_ENTITY,
            'status_message': error.errors()
        }
        logger.error(f'{request.method} {request.url} {str(error.errors())[:100]}')
        return ORJSONResponse(content=response_data)


def build_exception_handlers() -> Dict[Any, Callable]:
    """构建异常处理器映射"""
    return {
        HTTPException: ExceptionHandler.handle_http_error,
        RequestValidationError: ExceptionHandler.handle_validation_error,
        BaseErrorCode: ExceptionHandler.handle_http_error,
        Exception: ExceptionHandler.handle_http_error
    }


@asynccontextmanager
async def application_lifecycle(app_instance: FastAPI):
    """应用生命周期管理"""
    await initialize_app_context(config=settings)
    initialize_services()
    await init_default_data()
    yield
    teardown_services()
    thread_pool.tear_down()
    await close_app_context()


class ApplicationFactory:
    """应用工厂类"""
    
    CORS_ORIGINS = ['*']
    
    @classmethod
    def create(cls) -> FastAPI:
        """创建FastAPI应用实例"""
        app_instance = FastAPI(
            default_response_class=ORJSONResponse,
            exception_handlers=build_exception_handlers(),
            lifespan=application_lifecycle,
        )
        
        cls._setup_routes(app_instance)
        cls._setup_middleware(app_instance)
        cls._setup_exception_handlers(app_instance)
        cls._setup_debug_mode(app_instance)
        
        return app_instance
    
    @classmethod
    def _setup_routes(cls, app_instance: FastAPI):
        """配置路由"""
        @app_instance.get('/health')
        def health_check():
            return {'status': 'OK'}
        
        app_instance.include_router(api_router)
        app_instance.include_router(rpc_router)
    
    @classmethod
    def _setup_middleware(cls, app_instance: FastAPI):
        """配置中间件"""
        app_instance.add_middleware(
            CORSMiddleware,
            allow_origins=cls.CORS_ORIGINS,
            allow_credentials=False,
            allow_methods=['*'],
            allow_headers=['*'],
        )
        app_instance.add_middleware(CustomMiddleware)
        app_instance.add_middleware(WebSocketLoggingMiddleware)
    
    @classmethod
    def _setup_exception_handlers(cls, app_instance: FastAPI):
        """配置异常处理器"""
        @app_instance.exception_handler(AuthJWTException)
        def auth_exception_handler(request: Request, exc: AuthJWTException):
            return JSONResponse(status_code=401, content={'detail': str(exc)})
    
    @classmethod
    def _setup_debug_mode(cls, app_instance: FastAPI):
        """配置调试模式"""
        if settings.debug:
            import tracemalloc
            tracemalloc.start()


app = ApplicationFactory.create()


def run_server():
    """启动服务器"""
    import uvicorn
    
    set_logger_config(settings.logger_conf)
    uvicorn.run(app, host='0.0.0.0', port=7860, workers=1, log_config=None)


if __name__ == '__main__':
    run_server()
