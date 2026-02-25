from typing import Any, Dict, List, Optional

from mep.interface.base import LangChainTypeCreator
from mep.interface.importing.utils import import_class
from mep.template.frontend_node.autogenrole import AutogenRoleFrontNode
from loguru import logger
from mep.utils.util import build_template_from_class
from mep_langchain import autogen_role


class AutogenRole(LangChainTypeCreator):
    type_name: str = 'autogen_roles'

    @property
    def frontend_node_class(self) -> type[AutogenRoleFrontNode]:
        return AutogenRoleFrontNode

    @property
    def type_to_loader_dict(self) -> Dict:
        if self.type_dict is None:
            self.type_dict: dict[str, Any] = {
                role_name: import_class(f'mep_langchain.autogen_role.{role_name}')
                for role_name in autogen_role.__all__
            }
        return self.type_dict

    def get_signature(self, name: str) -> Optional[Dict]:
        try:
            return build_template_from_class(
                name, self.type_to_loader_dict, add_function=True
            )
        except ValueError as exc:
            raise ValueError('Agent not found') from exc
        except AttributeError as exc:
            logger.error(f'Agent {name} not loaded: {exc}')
            return None

    # Now this is a generator
    def to_list(self) -> List[str]:
        names = []
        for _, role in self.type_to_loader_dict.items():
            role_name = (role.function_name()
                         if hasattr(role, 'function_name') else role.__name__)
            names.append(role_name)
        return names


autogenrole_creator = AutogenRole()
