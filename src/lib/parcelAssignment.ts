export interface AssignmentOrder {
    delivery_kind: string
    status: string
    rider_id: string | null
    payment_status: string | null
}

export function isAwaitingParcelAssignment(order: AssignmentOrder): boolean {
    return order.delivery_kind === 'parcel'
        && order.payment_status === 'paid'
        && order.status === 'ready_for_pickup'
        && order.rider_id === null
}

export function orderStatusLabel(order: AssignmentOrder): string {
    if (isAwaitingParcelAssignment(order)) return 'Awaiting admin assignment'
    return order.status.split('_').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1),
    ).join(' ')
}
