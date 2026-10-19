import type { HttpContext } from '@adonisjs/core/http'
import DashboardService, {
  DASHBOARD_RANGES,
  type DashboardRange,
} from '#services/dashboard_service'

export default class AdminDashboardController {
  async show({ request }: HttpContext) {
    const raw = Number(request.input('days'))
    const days = (DASHBOARD_RANGES as readonly number[]).includes(raw)
      ? (raw as DashboardRange)
      : 30
    return DashboardService.overview(days)
  }
}
