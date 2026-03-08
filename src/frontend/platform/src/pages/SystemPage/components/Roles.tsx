import { PlusIcon } from "@/components/mep-icons/plus";
import { LoadingIcon } from "@/components/mep-icons/loading";
import { bsConfirm } from "@/components/mep-ui/alertDialog/useConfirm";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/mep-ui/dialog";
import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../../../components/mep-ui/button";
import { Input, SearchInput } from "../../../components/mep-ui/input";
import {
    Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow
} from "../../../components/mep-ui/table";
import {
    delRoleApi, getRolesByGroupApi, getUserGroupsApi,
    getUsersApi, updateUserRoles
} from "../../../controllers/API/user";
import { captureAndAlertRequestErrorHoc } from "../../../controllers/request";
import { ROLE } from "../../../types/api/user";
import EditRole from "./EditRole";
import { Search, UserPlus, Users, X } from "lucide-react";

// ─── 成员管理弹窗 ───────────────────────────────────────
function RoleMembersDialog({
    role, groupId, onClose
}: { role: ROLE | null; groupId: string; onClose: () => void }) {
    const [members, setMembers] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState<'list' | 'add'>('list');
    const [keyword, setKeyword] = useState('');
    const [candidates, setCandidates] = useState<any[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [saving, setSaving] = useState(false);
    const debounceRef = useRef<any>(null);

    const loadMembers = useCallback(async () => {
        if (!role) return;
        setLoading(true);
        try {
            const res: any = await getUsersApi({ name: '', page: 1, pageSize: 200, roleId: [role.id] });
            setMembers(res.data || []);
        } catch { /* ignore */ }
        setLoading(false);
    }, [role]);

    useEffect(() => {
        if (role) {
            setMode('list');
            setKeyword('');
            setSelected(new Set());
            loadMembers();
        }
    }, [role, loadMembers]);

    const searchCandidates = async (name: string) => {
        if (!role) return;
        setSearchLoading(true);
        try {
            const res: any = await getUsersApi({ name, page: 1, pageSize: 50 });
            const memberIds = new Set(members.map(m => m.user_id));
            setCandidates((res.data || []).filter((u: any) => !memberIds.has(u.user_id)));
        } catch { /* ignore */ }
        setSearchLoading(false);
    };

    const handleSearchInput = (val: string) => {
        setKeyword(val);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => searchCandidates(val), 300);
    };

    const switchToAdd = () => {
        setMode('add');
        setKeyword('');
        setSelected(new Set());
        setCandidates([]);
        searchCandidates('');
    };

    const toggleSelect = (uid: number) => {
        setSelected(prev => {
            const next = new Set(prev);
            next.has(uid) ? next.delete(uid) : next.add(uid);
            return next;
        });
    };

    const handleAddMembers = async () => {
        if (!role || selected.size === 0) return;
        setSaving(true);
        try {
            for (const userId of selected) {
                const candidate = candidates.find((u: any) => u.user_id === userId);
                const roleIds = (candidate?.roles || []).map((r: any) => r.id.toString());
                if (!roleIds.includes(role.id.toString())) {
                    roleIds.push(role.id.toString());
                }
                await updateUserRoles(userId, roleIds);
            }
            setMode('list');
            loadMembers();
        } catch { /* ignore */ }
        setSaving(false);
    };

    const handleRemove = async (user: any) => {
        if (!role) return;
        try {
            const updatedRoleIds = (user.roles || [])
                .map((r: any) => r.id.toString())
                .filter((rid: string) => rid !== role.id.toString());
            await captureAndAlertRequestErrorHoc(updateUserRoles(user.user_id, updatedRoleIds));
            loadMembers();
        } catch { /* ignore */ }
    };

    return (
        <Dialog open={!!role} onOpenChange={(b) => !b && onClose()}>
            <DialogContent className="sm:max-w-[520px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Users className="w-5 h-5" />
                        {role?.role_name} — 成员管理
                    </DialogTitle>
                </DialogHeader>

                {mode === 'list' ? (
                    <>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-500">
                                共 {members.length} 名成员
                            </span>
                            <Button variant="outline" size="sm" onClick={switchToAdd}>
                                <UserPlus className="w-4 h-4 mr-1" /> 添加成员
                            </Button>
                        </div>
                        <div className="max-h-[360px] overflow-y-auto border rounded-md">
                            {loading ? (
                                <div className="flex justify-center items-center h-[120px]"><LoadingIcon /></div>
                            ) : members.length === 0 ? (
                                <div className="text-center text-gray-400 py-10 text-sm">
                                    暂无成员，点击上方"添加成员"
                                </div>
                            ) : (
                                members.map((u: any) => (
                                    <div key={u.user_id}
                                        className="flex items-center justify-between px-4 py-2.5 border-b last:border-b-0 hover:bg-gray-50 dark:hover:bg-navy-800">
                                        <div className="flex-1 min-w-0">
                                            <span className="text-sm font-medium">{u.user_name}</span>
                                            <span className="text-xs text-gray-400 ml-2">
                                                {(u.roles || []).filter((r: any) => r.id !== role?.id).map((r: any) => r.name).join(', ')}
                                            </span>
                                        </div>
                                        <Button
                                            variant="ghost" size="sm"
                                            className="text-red-500 hover:text-red-700 h-7 px-2 shrink-0"
                                            disabled={u.roles?.some((r: any) => r.id === 1)}
                                            onClick={() => handleRemove(u)}
                                        >
                                            <X className="w-3.5 h-3.5 mr-0.5" /> 移除
                                        </Button>
                                    </div>
                                ))
                            )}
                        </div>
                    </>
                ) : (
                    <>
                        <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" onClick={() => setMode('list')}>
                                ← 返回
                            </Button>
                            <span className="text-sm font-medium">搜索并选择要添加的用户</span>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input
                                className="pl-9"
                                placeholder="搜索用户名"
                                value={keyword}
                                onChange={(e) => handleSearchInput(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <div className="max-h-[280px] overflow-y-auto border rounded-md">
                            {searchLoading ? (
                                <div className="flex justify-center items-center h-[100px]"><LoadingIcon /></div>
                            ) : candidates.length === 0 ? (
                                <div className="text-center text-gray-400 py-8 text-sm">暂无可添加的用户</div>
                            ) : (
                                candidates.map((u: any) => (
                                    <div key={u.user_id}
                                        className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer border-b last:border-b-0 hover:bg-gray-50 dark:hover:bg-navy-800 transition-colors ${selected.has(u.user_id) ? 'bg-primary/5' : ''}`}
                                        onClick={() => toggleSelect(u.user_id)}>
                                        <input type="checkbox" checked={selected.has(u.user_id)} readOnly className="rounded accent-primary" />
                                        <span className="text-sm flex-1 truncate">{u.user_name}</span>
                                        <span className="text-xs text-gray-400">
                                            {(u.roles || []).map((r: any) => r.name).join(', ')}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setMode('list')}>取消</Button>
                            <Button disabled={selected.size === 0 || saving} onClick={handleAddMembers}>
                                {saving ? '添加中...' : `确定添加 (${selected.size})`}
                            </Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

// ─── 状态管理 ────────────────────────────────────────────
interface State {
    roles: ROLE[];
    role: Partial<ROLE> | null;
    searchWord: string;
    group: string;
    groups: { label: string; value: string }[];
}

const initialState: State = {
    roles: [],
    role: null,
    searchWord: '',
    group: '',
    groups: []
};

type Action =
    | { type: 'SET_ROLES'; payload: ROLE[] }
    | { type: 'SET_ROLE'; payload: Partial<ROLE> | null }
    | { type: 'SET_SEARCH_WORD'; payload: string }
    | { type: 'SET_GROUP'; payload: string }
    | { type: 'SET_GROUPS'; payload: any };

function reducer(state: State, action: Action): State {
    switch (action.type) {
        case 'SET_ROLES':
            return { ...state, roles: action.payload };
        case 'SET_ROLE':
            return { ...state, role: action.payload };
        case 'SET_SEARCH_WORD':
            return { ...state, searchWord: action.payload };
        case 'SET_GROUP':
            return { ...state, group: action.payload };
        case 'SET_GROUPS':
            return { ...state, groups: action.payload };
        default:
            return state;
    }
}

// ─── 主组件 ──────────────────────────────────────────────
export default function Roles() {
    const { t } = useTranslation();
    const [state, dispatch] = useReducer(reducer, initialState);
    const allRolesRef = useRef<ROLE[]>([]);
    const [memberRole, setMemberRole] = useState<ROLE | null>(null);

    const loadData = useCallback(async () => {
        const inputDom = document.getElementById('role-input') as HTMLInputElement;
        if (inputDom) inputDom.value = '';
        try {
            if (!state.group) return;
            const data: any = await getRolesByGroupApi('', [state.group]);
            dispatch({ type: 'SET_ROLES', payload: data });
            allRolesRef.current = data;
        } catch (error) {
            console.error(error);
        }
    }, [state.group]);

    useEffect(() => {
        getUserGroupsApi().then((res: any) => {
            const groups = res.records.map(ug => ({ label: ug.group_name, value: ug.id }));
            dispatch({ type: 'SET_GROUP', payload: groups[0].value });
            dispatch({ type: 'SET_GROUPS', payload: groups });
        });
    }, []);

    useEffect(() => { loadData(); }, [state.group]);

    const handleDelete = async (item: ROLE) => {
        bsConfirm({
            desc: `${t('system.confirmText')} 【${item.role_name}】 ?`,
            okTxt: t('delete'),
            onOk: async (next) => {
                try {
                    await captureAndAlertRequestErrorHoc(delRoleApi(item.id));
                    await loadData();
                    next();
                } catch (error) {
                    console.error(error);
                }
            }
        });
    };

    const checkSameName = useCallback((name: string) => {
        return state.roles.find(_role => _role.role_name === name && state.role?.id !== _role.id);
    }, [state.roles, state.role]);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        const word = e.target.value;
        dispatch({ type: 'SET_SEARCH_WORD', payload: word });
        dispatch({
            type: 'SET_ROLES',
            payload: allRolesRef.current.filter(item =>
                item.role_name.toUpperCase().includes(word.toUpperCase())
            )
        });
    };

    if (state.role) {
        return <EditRole
            id={state.role.id || -1}
            name={state.role.role_name || ''}
            groupId={state.group}
            onBeforeChange={checkSameName}
            onChange={() => {
                dispatch({ type: 'SET_ROLE', payload: null });
                loadData();
            }}
        />;
    }

    return (
        <div className="relative">
            <div className="h-[calc(100vh-128px)] overflow-y-auto pt-2 pb-10">
                <div className="flex justify-end gap-4 items-center">
                    <div className="w-[200px] relative">
                        <SearchInput id="role-input" placeholder={t('system.roleName')} onChange={handleSearch} />
                    </div>
                    <Button className="flex justify-around" onClick={() => dispatch({ type: 'SET_ROLE', payload: {} })}>
                        <PlusIcon className="text-primary" />
                        <span className="text-[#fff] mx-4">{t('create')}</span>
                    </Button>
                </div>
                <Table className="mb-10">
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[200px]">{t('system.roleName')}</TableHead>
                            <TableHead>{t('createTime')}</TableHead>
                            <TableHead className="text-right">{t('operations')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {state.roles.map(el => (
                            <TableRow key={el.id}>
                                <TableCell className="font-medium">{el.role_name}</TableCell>
                                <TableCell>{el.create_time.replace('T', ' ')}</TableCell>
                                <TableCell className="text-right" style={{ whiteSpace: 'nowrap' }}>
                                    <Button variant="link" onClick={() => setMemberRole(el)} className="px-0 pl-4 text-blue-600">
                                        <Users className="w-3.5 h-3.5 mr-1 inline" />成员
                                    </Button>
                                    <Button variant="link" onClick={() => dispatch({ type: 'SET_ROLE', payload: el })} className="px-0 pl-4">{t('edit')}</Button>
                                    <Button variant="link" disabled={[1, 2].includes(el.id)} onClick={() => handleDelete(el)} className="text-red-500 px-0 pl-4">{t('delete')}</Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                    <TableFooter>
                        {!state.roles.length && <TableRow>
                            <TableCell colSpan={3} className="text-center text-gray-400">{t('build.empty')}</TableCell>
                        </TableRow>}
                    </TableFooter>
                </Table>
            </div>
            <div className="mep-table-footer bg-background-login">
                <p className="desc">{t('system.roleList')}.</p>
            </div>

            <RoleMembersDialog
                role={memberRole}
                groupId={state.group}
                onClose={() => setMemberRole(null)}
            />
        </div>
    );
}
