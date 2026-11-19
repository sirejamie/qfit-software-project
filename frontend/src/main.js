import { testSupabase } from "./testSupabase.js";
import { setupWaitingTime} from './waitingTime.js'

testSupabase();




const waitingEl = document.createElement('div')
document.querySelector('#app').appendChild(waitingEl)
setupWaitingTime(waitingEl, 'user1')