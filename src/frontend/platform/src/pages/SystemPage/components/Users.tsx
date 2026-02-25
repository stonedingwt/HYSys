import { FilterIcon } from "@/components/mep-icons/filter";
import { bsConfirm } from "@/components/mep-ui/alertDialog/useConfirm";
import { Button } from "@/components/mep-ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/mep-ui/popover";
import FilterUserGroup from "@/components/mep-ui/select/filter";
import { getRolesApi, getUserGroupsApi } from "@/controllers/API/user";
import { getOrgTreeApi, getOrgListApi, createOrgApi, updateOrgApi, deleteOrgApi, type OrgNode } from "@/controllers/API/org";
import { useContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Building2, ChevronDown, ChevronRight, FolderTree, List, Pencil, Plus, Trash2, Users2, X } from "lucide-react";
import { SearchInput, Input } from "../../../components/mep-ui/input";
import AutoPagination from "../../../components/mep-ui/pagination/autoPagination";
import {
    Table,
    TableBody,
    TableCell,
    TableFooter,
    TableHead,
    TableHeader,
    TableRow
} from "../../../components/mep-ui/table";
import { userContext } from "../../../contexts/userContext";
import { disableUserApi, getUsersApi } from "../../../controllers/API/user";
import { captureAndAlertRequestErrorHoc } from "../../../controllers/request";
import { useTable } from "../../../util/hook";
import UserRoleModal from "./UserRoleModal";
import UserPwdModal from "@/pages/LoginPage/UserPwdModal";
import { PlusIcon } from "@/components/mep-icons";
import CreateUser from "./CreateUser";

function UsersFilter({ options, onChecked, nameKey, placeholder, onFilter }) {
    const [open, setOpen] = useState(false)
    const [_value, setValue] = useState([])
    const [searchKey, setSearchKey] = useState('')
    // 点击 checkbox
    const handlerChecked = (id) => {
        setValue(val => {
            const index = val.indexOf(id)
            index === -1 ? val.push(id) : val.splice(index, 1)
            return [...val]
        })
        // 已选项上浮
        const checked = options.filter(o => _value.includes(o.id))
        const uncheck = options.filter(o => !_value.includes(o.id))
        onChecked([...checked, ...uncheck])
    }

    const filterData = () => {
        onFilter(_value)
        setOpen(false)
    }
    // 搜索
    const _options = useMemo(() => {
        if (!searchKey) return options
        return options.filter(a => a[nameKey].toUpperCase().includes(searchKey.toUpperCase()))
    }, [searchKey, options])
    // 重置
    const reset = () => {
        setValue([])
        setSearchKey('')
    }

    return <Popover open={open} onOpenChange={(bln) => { setOpen(bln); setSearchKey('') }}>
        <PopoverTrigger>
            {/* @ts-ignore */}
            <FilterIcon onClick={() => setOpen(!open)} className={_value.length ? 'text-primary ml-3' : 'text-gray-400 ml-3'} />
        </PopoverTrigger>
        <PopoverContent>
            <FilterUserGroup
                value={_value}
                options={_options}
                nameKey={nameKey}
                placeholder={placeholder}
                onChecked={handlerChecked}
                search={(e) => setSearchKey(e.target.value)}
                onClearChecked={reset}
                onOk={filterData}
            />
        </PopoverContent>
    </Popover>

}


const USER_TYPE_OPTIONS = [
    { value: 'local', label: '本地用户', color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
    { value: 'dingtalk', label: '钉钉用户', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
    { value: 'wecom', label: '企业微信用户', color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
    { value: 'feishu', label: '飞书用户', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' },
    { value: 'aad', label: 'AAD用户', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' },
];

function getTypeInfo(val?: string) {
    return USER_TYPE_OPTIONS.find(o => o.value === val) || USER_TYPE_OPTIONS[0];
}

function OrgTreeNode({ node, level = 0, selected, onSelect, onAdd, onEdit, onDelete, isAdmin }: {
    node: OrgNode; level?: number; selected: number | null; isAdmin: boolean;
    onSelect: (id: number) => void;
    onAdd: (parentId: number) => void;
    onEdit: (node: OrgNode) => void;
    onDelete: (id: number) => void;
}) {
    const [expanded, setExpanded] = useState(true);
    const hasChildren = node.children && node.children.length > 0;
    return (
        <div>
            <div
                className={`flex items-center gap-1 px-2 py-1.5 rounded cursor-pointer group text-sm transition-colors ${
                    selected === node.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-gray-100 dark:hover:bg-[#333] text-gray-700 dark:text-gray-300'
                }`}
                style={{ paddingLeft: `${level * 16 + 8}px` }}
                onClick={() => onSelect(node.id)}
            >
                <span className="w-4 flex-shrink-0" onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}>
                    {hasChildren ? (expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />) : null}
                </span>
                <Building2 className="w-4 h-4 flex-shrink-0 text-gray-400" />
                <span className="truncate flex-1">{node.name}</span>
                <span className="text-[10px] text-gray-400 flex-shrink-0">{node.org_type === 'company' ? '公司' : '部门'}</span>
                {isAdmin && (
                    <div className="hidden group-hover:flex items-center gap-0.5 flex-shrink-0">
                        <button onClick={(e) => { e.stopPropagation(); onAdd(node.id); }}
                            className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600" title="添加子部门"><Plus className="w-3 h-3" /></button>
                        <button onClick={(e) => { e.stopPropagation(); onEdit(node); }}
                            className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600" title="编辑"><Pencil className="w-3 h-3" /></button>
                        <button onClick={(e) => { e.stopPropagation(); onDelete(node.id); }}
                            className="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900 text-red-500" title="删除"><Trash2 className="w-3 h-3" /></button>
                    </div>
                )}
            </div>
            {expanded && hasChildren && node.children!.map(child => (
                <OrgTreeNode key={child.id} node={child} level={level + 1} selected={selected}
                    onSelect={onSelect} onAdd={onAdd} onEdit={onEdit} onDelete={onDelete} isAdmin={isAdmin} />
            ))}
        </div>
    );
}

function OrgDialog({ open, orgType, parentId, editNode, onClose, onSave }: {
    open: boolean; orgType: string; parentId: number | null;
    editNode: OrgNode | null; onClose: () => void;
    onSave: (data: any) => void;
}) {
    const [name, setName] = useState('');
    const [remark, setRemark] = useState('');
    useEffect(() => {
        if (editNode) { setName(editNode.name); setRemark(editNode.remark || ''); }
        else { setName(''); setRemark(''); }
    }, [editNode, open]);
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-[#fff] dark:bg-gray-900 rounded-lg shadow-xl w-[400px] p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-semibold">{editNode ? '编辑' : '新建'}{orgType === 'company' ? '公司' : '部门'}</h3>
                    <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"><X className="w-4 h-4" /></button>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">名称</label>
                        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={`请输入${orgType === 'company' ? '公司' : '部门'}名称`} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">备注</label>
                        <Input value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="备注（选填）" />
                    </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                    <Button variant="outline" onClick={onClose}>取消</Button>
                    <Button onClick={() => {
                        if (!name.trim()) return;
                        onSave({ name: name.trim(), org_type: editNode ? editNode.org_type : orgType, parent_id: editNode ? editNode.parent_id : parentId, remark: remark.trim(), ...(editNode ? { id: editNode.id } : {}) });
                    }}>确定</Button>
                </div>
            </div>
        </div>
    );
}

export default function Users(params) {
    const { user } = useContext(userContext);
    const { t } = useTranslation()
    const isAdmin = user.role === 'admin';

    const { page, pageSize, data: users, total, setPage, search, reload, filterData } = useTable({ pageSize: 20 }, (param) =>
        getUsersApi({
            ...param,
            name: param.keyword
        })
    )

    // Organization state
    const [orgTree, setOrgTree] = useState<OrgNode[]>([]);
    const [orgFlat, setOrgFlat] = useState<OrgNode[]>([]);
    const [selectedOrg, setSelectedOrg] = useState<number | null>(null);
    const [viewMode, setViewMode] = useState<'tree' | 'list'>('tree');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [dialogOrgType, setDialogOrgType] = useState('company');
    const [dialogParentId, setDialogParentId] = useState<number | null>(null);
    const [editNode, setEditNode] = useState<OrgNode | null>(null);

    const loadOrgs = useCallback(async () => {
        try {
            const treeRes: any = await getOrgTreeApi();
            setOrgTree(treeRes ?? []);
            const flatRes: any = await getOrgListApi();
            setOrgFlat(flatRes ?? []);
        } catch { /* ignore */ }
    }, []);

    const orgMap = useMemo(() => {
        const m: Record<number, OrgNode> = {};
        const flatten = (nodes: OrgNode[]) => { for (const n of nodes) { m[n.id] = n; if (n.children) flatten(n.children); } };
        flatten(orgTree);
        return m;
    }, [orgTree]);

    const handleAddOrg = (parentId: number | null, type = 'department') => {
        setEditNode(null); setDialogOrgType(type); setDialogParentId(parentId); setDialogOpen(true);
    };
    const handleEditOrg = (node: OrgNode) => {
        setEditNode(node); setDialogOrgType(node.org_type); setDialogParentId(node.parent_id); setDialogOpen(true);
    };
    const handleDeleteOrg = async (id: number) => {
        bsConfirm({
            desc: '确定删除该组织及其所有子组织？',
            okTxt: t('delete'),
            onOk(next) {
                captureAndAlertRequestErrorHoc(deleteOrgApi(id).then(() => loadOrgs()));
                next();
            }
        });
    };
    const handleSaveOrg = async (data: any) => {
        if (data.id) {
            await captureAndAlertRequestErrorHoc(updateOrgApi(data));
        } else {
            await captureAndAlertRequestErrorHoc(createOrgApi(data));
        }
        setDialogOpen(false);
        loadOrgs();
    };

    // 禁用确认
    const handleDelete = (user) => {
        bsConfirm({
            title: `${t('prompt')}!`,
            desc: t('system.confirmDisable'),
            okTxt: t('disable'),
            onOk(next) {
                captureAndAlertRequestErrorHoc(disableUserApi(user.user_id, 1).then(res => {
                    reload()
                }))
                next()
            }
        })
    }
    const handleEnableUser = (user) => {
        captureAndAlertRequestErrorHoc(disableUserApi(user.user_id, 0).then(res => {
            reload()
        }))
    }

    // 编辑
    const [currentUser, setCurrentUser] = useState(null)
    const userPwdModalRef = useRef(null)
    const handleRoleChange = () => {
        setCurrentUser(null)
        reload()
    }

    // 获取用户组类型数据
    const [userGroups, setUserGroups] = useState([])
    const getUserGoups = async () => {
        const res: any = await getUserGroupsApi()
        setUserGroups(res.records)
    }
    // 获取角色类型数据
    const [roles, setRoles] = useState([])
    const getRoles = async () => {
        const res: any = await getRolesApi()
        setRoles(res)
    }
    // 已选项上浮
    const handleGroupChecked = (values) => {
        setUserGroups(values)
    }
    const handleRoleChecked = (values) => {
        setRoles(values)
    }

    const [openCreate, setOpenCreate] = useState(false)

    useEffect(() => {
        getUserGoups()
        getRoles()
        loadOrgs()
        return () => { setUserGroups([]); setRoles([]) }
    }, [])

    const operations = (el) => {
        const isSuperAdmin = el.roles.some(role => role.id === 1)
        if (isSuperAdmin) return <div>
            <Button variant="link" disabled className="px-0">{t('edit')}</Button>
            <Button variant="link" className="px-0 pl-4" onClick={() => userPwdModalRef.current.open(el.user_id)}>{t('system.resetPwd')}</Button>
            <Button variant="link" disabled className="text-red-500 px-0 pl-4">{t('disable')}</Button>
        </div>

        return <div>
            <Button variant="link" disabled={user.user_id === el.user_id} onClick={() => setCurrentUser(el)} className="px-0">{t('edit')}</Button>
            {(user.role === 'admin' || user.role === 'group_admin') &&
                <Button variant="link" className="px-0 pl-4" onClick={() => userPwdModalRef.current.open(el.user_id)}>{t('system.resetPwd')}</Button>}
            {
                el.delete === 1 ? <Button variant="link" onClick={() => handleEnableUser(el)} className="text-green-500 px-0 pl-4">{t('enable')}</Button> :
                    <Button variant="link" disabled={user.user_id === el.user_id} onClick={() => handleDelete(el)} className="text-red-500 px-0 pl-4">{t('disable')}</Button>
            }
        </div>
    }

    return <div className="relative flex gap-4">
        {/* 左侧组织架构面板 */}
        <div className="w-[240px] flex-shrink-0 border border-gray-200 dark:border-gray-700 rounded-lg bg-[#fafafa] dark:bg-[#1a1a1a] flex flex-col" style={{ height: 'calc(100vh - 150px)' }}>
            <div className="px-3 py-3 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold">组织架构</h3>
                    <div className="flex items-center gap-1">
                        <button onClick={() => setViewMode('tree')}
                            className={`p-1 rounded ${viewMode === 'tree' ? 'bg-primary/10 text-primary' : 'text-gray-400 hover:text-gray-600'}`} title="树状视图">
                            <FolderTree className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setViewMode('list')}
                            className={`p-1 rounded ${viewMode === 'list' ? 'bg-primary/10 text-primary' : 'text-gray-400 hover:text-gray-600'}`} title="列表视图">
                            <List className="w-3.5 h-3.5" /></button>
                    </div>
                </div>
                {isAdmin && (
                    <button onClick={() => handleAddOrg(null, 'company')}
                        className="w-full flex items-center justify-center gap-1 px-2 py-1.5 text-xs rounded-md border border-dashed border-gray-300 dark:border-gray-600 text-gray-500 hover:border-primary hover:text-primary transition-colors">
                        <Plus className="w-3 h-3" /> 新建公司
                    </button>
                )}
            </div>
            <div className="flex-1 overflow-y-auto p-2">
                {viewMode === 'tree' ? (
                    <div>
                        <div className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm ${selectedOrg === null ? 'bg-primary/10 text-primary font-medium' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#333]'}`}
                            onClick={() => setSelectedOrg(null)}>
                            <Users2 className="w-4 h-4" /><span>全部用户</span>
                        </div>
                        {orgTree.map(node => (
                            <OrgTreeNode key={node.id} node={node} selected={selectedOrg}
                                onSelect={setSelectedOrg} onAdd={(pid) => handleAddOrg(pid)} onEdit={handleEditOrg} onDelete={handleDeleteOrg} isAdmin={isAdmin} />
                        ))}
                    </div>
                ) : (
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="text-gray-500 border-b"><th className="text-left py-1 px-1">名称</th><th className="text-left py-1 px-1">类型</th><th className="text-left py-1 px-1">上级</th></tr>
                        </thead>
                        <tbody>
                            {orgFlat.map(org => (
                                <tr key={org.id} className={`border-b cursor-pointer ${selectedOrg === org.id ? 'bg-primary/10' : 'hover:bg-gray-50 dark:hover:bg-[#333]'}`}
                                    onClick={() => setSelectedOrg(org.id)}>
                                    <td className="py-1.5 px-1">{org.name}</td>
                                    <td className="py-1.5 px-1 text-gray-500">{org.org_type === 'company' ? '公司' : '部门'}</td>
                                    <td className="py-1.5 px-1 text-gray-500">{org.parent_id ? orgMap[org.parent_id]?.name || '-' : '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>

        {/* 右侧用户列表 */}
        <div className="flex-1 min-w-0">
            <div className="h-[calc(100vh-128px)] overflow-y-auto pb-10">
                <div className="flex justify-end gap-6">
                    <div className="w-[180px] relative">
                        <SearchInput placeholder={t('system.username')} onChange={(e) => search(e.target.value)}></SearchInput>
                    </div>
                    {isAdmin && <Button className="flex justify-around" onClick={() => setOpenCreate(true)}>
                        <PlusIcon className="text-primary" />
                        <span className="text-[#fff] mx-4">{t('create')}</span>
                    </Button>}
                </div>
                <Table className="mb-[50px]">
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[150px]">{t('system.username')}</TableHead>
                            <TableHead className="w-[100px]">用户类型</TableHead>
                            <TableHead>
                                <div className="flex items-center">
                                    {t('system.userGroup')}
                                    <UsersFilter options={userGroups} nameKey='group_name' onChecked={handleGroupChecked}
                                        placeholder={t('system.searchUserGroups')} onFilter={(ids) => filterData({ groupId: ids })} />
                                </div>
                            </TableHead>
                            <TableHead>
                                <div className="flex items-center">
                                    {t('system.role')}
                                    <UsersFilter options={roles} nameKey='role_name' onChecked={handleRoleChecked}
                                        placeholder={t('system.searchRoles')} onFilter={(ids) => filterData({ roleId: ids })} />
                                </div>
                            </TableHead>
                            <TableHead>组织/部门</TableHead>
                            <TableHead>{t('system.changeTime')}</TableHead>
                            <TableHead className="text-right w-[164px]">{t('operations')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users.map((el: any) => {
                            const typeInfo = getTypeInfo(el.user_type);
                            return (
                                <TableRow key={el.id}>
                                    <TableCell className="font-medium max-w-[150px] truncate">{el.user_name}</TableCell>
                                    <TableCell>
                                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium ${typeInfo.color}`}>
                                            {typeInfo.label}
                                        </span>
                                    </TableCell>
                                    <TableCell className="break-all">{(el.groups || []).map(g => g.name).join(',')}</TableCell>
                                    <TableCell className="break-all">{(el.roles || []).map(r => r.name).join(',')}</TableCell>
                                    <TableCell className="text-gray-500">{el.dept_id && orgMap[Number(el.dept_id)] ? orgMap[Number(el.dept_id)].name : '-'}</TableCell>
                                    <TableCell>{el.update_time?.replace('T', ' ')}</TableCell>
                                    <TableCell className="text-right" style={{ whiteSpace: 'nowrap' }}>{operations(el)}</TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                    <TableFooter>
                        {!users.length && <TableRow>
                            <TableCell colSpan={7} className="text-center text-gray-400">{t('build.empty')}</TableCell>
                        </TableRow>}
                    </TableFooter>
                </Table>
            </div>
            <div className="mep-table-footer bg-background-login">
                <p className="desc">{t('system.userList')}</p>
                <AutoPagination className="float-right justify-end w-full mr-6" page={page} pageSize={pageSize} total={total}
                    onChange={(newPage) => setPage(newPage)} />
            </div>
        </div>

        <CreateUser open={openCreate} onClose={(bool) => { setOpenCreate(bool); reload() }} onSave={reload} />
        <UserRoleModal user={currentUser} onClose={() => setCurrentUser(null)} onChange={handleRoleChange}></UserRoleModal>
        <UserPwdModal ref={userPwdModalRef} />
        <OrgDialog open={dialogOpen} orgType={dialogOrgType} parentId={dialogParentId} editNode={editNode}
            onClose={() => setDialogOpen(false)} onSave={handleSaveOrg} />
    </div>
};
