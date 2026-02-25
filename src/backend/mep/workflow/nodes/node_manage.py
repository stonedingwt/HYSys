from mep.workflow.common.node import NodeType
from mep.workflow.nodes.agent.agent import AgentNode
from mep.workflow.nodes.code.code import CodeNode
from mep.workflow.nodes.condition.condition import ConditionNode
from mep.workflow.nodes.end.end import EndNode
from mep.workflow.nodes.input.input import InputNode
from mep.workflow.nodes.knowledge_retriever.knowledge_retriever import KnowledgeRetriever
from mep.workflow.nodes.llm.llm import LLMNode
from mep.workflow.nodes.output.output import OutputNode
from mep.workflow.nodes.qa_retriever.qa_retriever import QARetrieverNode
from mep.workflow.nodes.rag.rag import RagNode
from mep.workflow.nodes.report.report import ReportNode
from mep.workflow.nodes.start.start import StartNode
from mep.workflow.nodes.tool.tool import ToolNode

NODE_CLASS_MAP = {
    NodeType.START.value: StartNode,
    NodeType.END.value: EndNode,
    NodeType.INPUT.value: InputNode,
    NodeType.OUTPUT.value: OutputNode,
    NodeType.TOOL.value: ToolNode,
    NodeType.RAG.value: RagNode,
    NodeType.REPORT.value: ReportNode,
    NodeType.QA_RETRIEVER.value: QARetrieverNode,
    NodeType.CONDITION.value: ConditionNode,
    NodeType.AGENT.value: AgentNode,
    NodeType.CODE.value: CodeNode,
    NodeType.LLM.value: LLMNode,
    NodeType.KNOWLEDGE_RETRIEVER.value: KnowledgeRetriever,
}


class NodeFactory:
    @classmethod
    def get_node_class(cls, node_type: str) -> 'BaseNode':
        return NODE_CLASS_MAP.get(node_type)

    @classmethod
    def instance_node(cls, node_type: str, **kwargs) -> 'BaseNode':
        node_class = cls.get_node_class(node_type)
        if node_class is None:
            raise Exception(f'Unknown node type:{node_type}')
        return node_class(**kwargs)
