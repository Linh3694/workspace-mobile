import { Message } from '../types/message';

export function getMessageGroupPosition(
    messagesWithTime: any[],
    index: number,
    isDifferentDay: (a: string, b: string) => boolean
) {
    const item = messagesWithTime[index];

    // Find the previous actual message (skip time separators)
    let prevMessage = null;
    for (let i = index - 1; i >= 0; i--) {
        const m = messagesWithTime[i];
        if (m._id && m.type !== 'time') {
            prevMessage = m;
            break;
        }
    }

    // Find the next actual message (skip time separators)
    let nextMessage = null;
    for (let i = index + 1; i < messagesWithTime.length; i++) {
        const m = messagesWithTime[i];
        if (m._id && m.type !== 'time') {
            nextMessage = m;
            break;
        }
    }

    const sameSenderAsPrev = prevMessage && prevMessage.sender._id === item.sender._id;
    const sameDayAsPrev = prevMessage && !isDifferentDay(prevMessage.createdAt, item.createdAt);

    const sameSenderAsNext = nextMessage && nextMessage.sender._id === item.sender._id;
    const sameDayAsNext = nextMessage && !isDifferentDay(nextMessage.createdAt, item.createdAt);

    const isFirst = !prevMessage || !sameSenderAsPrev || !sameDayAsPrev;
    const isLast = !nextMessage || !sameSenderAsNext || !sameDayAsNext;

    return { isFirst, isLast };
}
