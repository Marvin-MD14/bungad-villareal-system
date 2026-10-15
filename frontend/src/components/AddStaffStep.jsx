import React, { useState, useEffect } from 'react';
import { Users, UserPlus, X } from 'lucide-react';
import { api } from '../utils/api';

const records = (response) => response.data.results || response.data;

export default function AddStaffStep({
  businessId,
  initialData = [],
  onNext,
  onSkip,
  isDarkMode = false,
}) {
  const [profiles, setProfiles] = useState([]);
  const [roles, setRoles] = useState([]);
  const [services, setServices] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState(initialData);
  const [loading, setLoading] = useState(true);

  const OUTLET_ROLES = ['BUSINESS_MANAGER', 'SUPERVISOR', 'CASHIER', 'STAFF'];

  useEffect(() => {
    const loadData = async () => {
      try {
        const [profilesRes, capsRes, servicesRes] = await Promise.all([
          api.get('/user-profiles/'),
          api.get('/auth/capabilities/'),
          api.get('/catalog/items/?item_type=SERVICE'),
        ]);
        setProfiles(records(profilesRes));
        const caps = records(capsRes);
        if (caps.roles) {
          setRoles(caps.roles.filter((r) => OUTLET_ROLES.includes(r.code)));
        }
        setServices(records(servicesRes));
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const toggleStaff = (profile) => {
    const exists = selectedStaff.find((s) => s.userId === profile.user?.id);
    if (exists) {
      setSelectedStaff(selectedStaff.filter((s) => s.userId !== profile.user?.id));
    } else {
      setSelectedStaff([
        ...selectedStaff,
        { userId: profile.user?.id, role: 'STAFF', serviceIds: [], profile },
      ]);
    }
  };

  const updateStaffRole = (userId, role) => {
    setSelectedStaff(
      selectedStaff.map((s) =>
        s.userId === userId ? { ...s, role } : s
      )
    );
  };

  const toggleService = (userId, serviceId) => {
    setSelectedStaff(
      selectedStaff.map((s) => {
        if (s.userId !== userId) return s;
        const hasService = s.serviceIds.includes(serviceId);
        return {
          ...s,
          serviceIds: hasService
            ? s.serviceIds.filter((id) => id !== serviceId)
            : [...s.serviceIds, serviceId],
        };
      })
    );
  };

  const handleNext = () => {
    onNext(selectedStaff);
  };

  const input = isDarkMode
    ? 'bg-slate-700 border-slate-600 text-white'
    : 'bg-white border-slate-200 text-slate-700';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <Users className="mx-auto h-12 w-12 text-cyan-500 mb-3" />
        <h3 className="text-lg font-bold">Add Staff Members</h3>
        <p className="text-sm text-slate-500 mt-1">
          Assign staff to this business. You can skip this and add staff later.
        </p>
      </div>
      <div className="max-h-64 overflow-y-auto space-y-2">
        {profiles.map((profile) => {
          const isSelected = selectedStaff.some((s) => s.userId === profile.user?.id);
          const staffData = selectedStaff.find((s) => s.userId === profile.user?.id);
          return (
            <div
              key={profile.id}
              className={"p-3 rounded-lg border " + (isDarkMode ? 'border-slate-700' : 'border-slate-200') + " " + (isSelected ? (isDarkMode ? 'bg-cyan-900/20' : 'bg-cyan-50') : '')}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleStaff(profile)}
                    className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                  />
                  <div>
                    <p className="font-medium text-sm">
                      {profile.user?.first_name} {profile.user?.last_name}
                    </p>
                    <p className="text-xs text-slate-500">@{profile.user?.username}</p>
                  </div>
                </div>
              </div>
              {isSelected && staffData && (
                <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 space-y-3">
                  <div>
                    <label className="text-xs font-medium text-slate-500">Role</label>
                    <select
                      value={staffData.role}
                      onChange={(e) => updateStaffRole(staffData.userId, e.target.value)}
                      className={"mt-1 w-full rounded-lg border p-2 text-sm " + input}
                    >
                      {roles.map((role) => (
                        <option key={role.code} value={role.code}>
                          {role.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
        <button
          type="button"
          onClick={onSkip}
          className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700"
        >
          Skip
        </button>
        <button
          type="button"
          onClick={handleNext}
          className="px-6 py-2 bg-cyan-500 text-white text-sm font-semibold rounded-lg hover:bg-cyan-600 transition"
        >
          Next
        </button>
      </div>
    </div>
  );
}

