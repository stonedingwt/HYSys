export interface Task {
  id: number;
  task_number: string;
  task_name: string;
  task_type: string;
  status: string;
  priority_label: string;
  agent_id: string | null;
  chat_id: string | null;
  assignee_id: number | null;
  creator_id: number | null;
  due_date: string | null;
  description: string | null;
  main_form_type: string | null;
  main_form_id: number | null;
  tags: string[] | null;
  extra: Record<string, any> | null;
  is_focused: boolean;
  create_time: string;
  update_time: string;
  latest_message: string | null;
  latest_message_time: string | null;
}

export interface TaskStages {
  stages: string[];
  current: string;
  current_index: number;
  is_last: boolean;
}

export interface TaskStats {
  total: number;
  in_progress: number;
  done: number;
  focused: number;
  risk: number;
}

export interface TaskFormItem {
  id: number;
  task_id: number;
  form_type: string;
  form_id: number | null;
  form_name: string;
  is_main: boolean;
  create_time: string;
}

export interface TaskLog {
  id: number;
  task_id: number;
  log_type: string;
  form_type: string | null;
  form_id: number | null;
  content: string | null;
  detail: Record<string, any> | null;
  user_id: number | null;
  user_name: string | null;
  create_time: string;
}

export interface TransferableUser {
  user_id: number;
  user_name: string;
}

export interface TaskDetail extends Task {
  forms: TaskFormItem[];
  latest_log: TaskLog | null;
}
