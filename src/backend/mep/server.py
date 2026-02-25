"""
Gunicorn Application Server
元境Gunicorn服务器模块
"""
from typing import Optional, Dict, Any

from gunicorn.app.base import BaseApplication  # type: ignore


class GunicornConfig:
    """Gunicorn配置类"""
    
    DEFAULT_BIND = '0.0.0.0:7860'
    DEFAULT_WORKERS = 1
    DEFAULT_WORKER_CLASS = 'uvicorn.workers.UvicornWorker'
    DEFAULT_TIMEOUT = 120
    DEFAULT_KEEPALIVE = 5
    
    @classmethod
    def get_default_options(cls) -> Dict[str, Any]:
        """获取默认配置选项"""
        return {
            'bind': cls.DEFAULT_BIND,
            'workers': cls.DEFAULT_WORKERS,
            'worker_class': cls.DEFAULT_WORKER_CLASS,
            'timeout': cls.DEFAULT_TIMEOUT,
            'keepalive': cls.DEFAULT_KEEPALIVE,
        }


class MEPGunicornApplication(BaseApplication):
    """MEP Gunicorn应用类"""
    
    def __init__(self, app_instance: Any, options: Optional[Dict[str, Any]] = None):
        """
        初始化Gunicorn应用
        
        Args:
            app_instance: FastAPI应用实例
            options: Gunicorn配置选项
        """
        self._app = app_instance
        self._options = options or GunicornConfig.get_default_options()
        super().__init__()
    
    def load_config(self) -> None:
        """加载Gunicorn配置"""
        for key, value in self._options.items():
            if key in self.cfg.settings and value is not None:
                self.cfg.set(key.lower(), value)
    
    def load(self) -> Any:
        """加载应用实例"""
        return self._app


def create_gunicorn_app(app_instance: Any, **kwargs) -> MEPGunicornApplication:
    """
    创建Gunicorn应用实例
    
    Args:
        app_instance: FastAPI应用实例
        **kwargs: 额外的Gunicorn配置选项
        
    Returns:
        MEPGunicornApplication实例
    """
    options = {**GunicornConfig.get_default_options(), **kwargs}
    return MEPGunicornApplication(app_instance, options)
