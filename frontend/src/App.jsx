import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import ResetPassword from './pages/ResetPassword'
import GroupDetails from './pages/GroupDetails'
import GroupExpenses from './pages/GroupExpenses'
import ExpenseDetails from './pages/ExpenseDetails'
import GroupBalances from './pages/GroupBalances'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/groups/:id" element={<GroupDetails />} />
      <Route path="/groups/:id/expenses" element={<GroupExpenses />} />
      <Route path="/groups/:id/balances" element={<GroupBalances />} />
      <Route path="/expenses/:expenseId" element={<ExpenseDetails />} />
      {/* Redirect root to login */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default App
