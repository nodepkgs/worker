import { PoolClient, Pool } from "pg";
import { IDebugger } from "./debug";

/*
 * Terminology:
 *
 * - job: an entry in the `jobs` table, representing work to be done
 * - queue: an entry in the `job_queues` table, representing a list of jobs to be executed sequentially
 * - task_identifier: the name of the task to be executed to complete the job
 * - task: a function representing code to be executed for a particular job (identified by the task_identifier); i.e. a file in the `tasks/` folder
 * - task list: an object collection of named tasks
 * - watched task list: an abstraction for a task list that can be updated when the tasks on the disk change
 * - worker: the thing that checks out a job from the database, executes the relevant task, and then returns the job to the database with either success or failure
 * - worker pool: a collection of workers to enable processing multiple jobs in parallel
 * - runner: the class responsible for building a task list and running a worker pool for said list
 */

export type WithPgClient = <T = void>(
  callback: (pgClient: PoolClient) => Promise<T>
) => Promise<T>;

export type AddJobFunction = (
  identifier: string,
  payload?: any,
  options?: TaskOptions
) => Promise<Job>;

export interface Helpers {
  job: Job;
  debug: IDebugger;
  withPgClient: WithPgClient;
  addJob: AddJobFunction;
}

export type Task = (payload: unknown, helpers: Helpers) => void | Promise<void>;

export function isValidTask(fn: any): fn is Task {
  if (typeof fn === "function") {
    return true;
  }
  return false;
}

export interface TaskList {
  [name: string]: Task;
}

export interface WatchedTaskList {
  tasks: TaskList;
  release: () => void;
}

export interface Job {
  id: number;
  queue_name: string;
  task_identifier: string;
  payload: unknown;
  priority: number;
  run_at: Date;
  attempts: number;
  last_error: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Worker {
  nudge: () => boolean;
  workerId: string;
  release: () => void;
  promise: Promise<void>;
  getActiveJob: () => Job | null;
}

export interface WorkerPool {
  release: () => Promise<void>;
  gracefulShutdown: (message: string) => Promise<void>;
  promise: Promise<void>;
}

export interface Runner {
  stop: () => Promise<void>;
  addJob: AddJobFunction;
  promise: Promise<void>;
}

export interface TaskOptions {
  /**
   * the queue to run this task under
   */
  queueName?: string;
  /**
   * a Date to schedule this task to run in the future
   */
  runAt?: Date;
  /**
   * how many retries should this task get? (Default: 25)
   */
  maxAttempts?: number;
}

export interface WorkerOptions {
  /**
   * how long to wait between polling for jobs in milliseconds (for jobs scheduled in the future/retries)
   */
  pollInterval?: number;
  workerId?: string;
}

export interface WorkerPoolOptions extends WorkerOptions {
  /**
   * number of jobs to run concurrently
   */
  workerCount?: number;
}

export interface RunnerOptions extends WorkerPoolOptions {
  /**
   * task names and handler, e.g. from `getTasks` (use this if you need watch mode)
   */
  taskList?: TaskList;
  /**
   * each file in this directory will be used as a task handler
   */
  taskDirectory?: string;
  /**
   * A PostgreSQL connection string to the database containing the job queue
   */
  connectionString?: string;
  /**
   * A pg.Pool instance to use instead of the `connectionString`
   */
  pgPool?: Pool;
}
