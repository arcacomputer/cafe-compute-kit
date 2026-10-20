import {createSender} from '../../sender.mjs';
import {projectSenderEnv} from '../../environment.mjs';
export default createSender({env:projectSenderEnv(process.env)});
