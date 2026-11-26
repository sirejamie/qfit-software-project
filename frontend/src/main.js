
import { setupWaitingTime} from './waitingTime.js'

const waitingEl = document.createElement('div')
document.querySelector('#app').appendChild(waitingEl)
setupWaitingTime(waitingEl, 'student1')