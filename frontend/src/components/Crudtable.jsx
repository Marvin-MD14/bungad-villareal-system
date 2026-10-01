import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { Search, Plus, Edit3, Trash2, RefreshCw, ChevronLeft, ChevronRight, Download, X, Loader2 } from 'lucide-react';
import { API_BASE_URL } from '../utils/api';
import { applyBusinessHeader } from '../utils/session';

export default function CrudTable({ title, apiEndpoint, columns, isDarkMode = false, readOnly = false }) {
  const [data, setData] = useState([]); // Default to empty array
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const itemsPerPage = 10;

  const authHeaders = () => {
    const token = localStorage.getItem('authToken');
    // CrudTable uses fetch() rather than the shared axios client, so it applies
    // the same two headers by hand — the business context included, which the
    // old copy silently dropped.
    return {
      ...(token ? { Authorization: `Token ${token}` } : {}),
      ...applyBusinessHeader({ headers: {} }).headers,
    };
  };

  // ============ URL BUILDING ============
  // `apiEndpoint` may carry a filter (e.g. `catalog/items?item_type=SERVICE`),
  // so the trailing slash has to go on the *path*, before the query string —
  // appending it blindly would turn `item_type=SERVICE` into `SERVICE/`.
  const endpointUrl = (id) => {
    const [path, query] = apiEndpoint.split('?');
    const url = id ? `${API_BASE_URL}/${path}/${id}/` : `${API_BASE_URL}/${path}/`;
    return query ? `${url}?${query}` : url;
  };

  // ============ FETCH DATA ============
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(endpointUrl(), {
        headers: authHeaders(),
      });
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const result = await res.json();
      
      // Ensure data is always an array
      if (Array.isArray(result)) {
        setData(result);
      } else if (result && typeof result === 'object') {
        // If response is an object, try to find the array
        const possibleArray = Object.values(result).find(val => Array.isArray(val));
        if (possibleArray) {
          setData(possibleArray);
        } else {
          setData([]);
        }
      } else {
        setData([]);
      }
      
      console.log(`✅ ${title} data loaded:`, data.length, 'records');
    } catch (error) {
      console.error('Fetch error:', error);
      setError(error.message);
      setData([]); // Set to empty array on error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [apiEndpoint]);

  // ============ SAVE DATA ============
  const saveData = async () => {
    const url = endpointUrl(editingId || null);
    
    const method = editingId ? 'PUT' : 'POST';
    
    setLoading(true);
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(formData)
      });
      
      if (res.ok) {
        Swal.fire({
          icon: 'success',
          title: 'Success!',
          text: `Item ${editingId ? 'updated' : 'added'} successfully`,
          timer: 1500,
          showConfirmButton: false,
        });
        setIsModalOpen(false);
        setEditingId(null);
        setFormData({});
        fetchData();
      } else {
        const errorData = await res.json();
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: errorData.message || 'Something went wrong',
          confirmButtonColor: '#0ea5e9',
        });
      }
    } catch {
      Swal.fire({
        icon: 'error',
        title: 'Network Error',
        text: 'Please check your connection',
        confirmButtonColor: '#0ea5e9',
      });
    } finally {
      setLoading(false);
    }
  };

  // ============ DELETE DATA ============
  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: "You won't be able to revert this!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, delete it!'
    });
    
    if (result.isConfirmed) {
      try {
        await fetch(endpointUrl(id), {
          method: 'DELETE',
          headers: authHeaders(),
        });
        Swal.fire({
          icon: 'success',
          title: 'Deleted!',
          text: 'Item has been deleted.',
          timer: 1500,
          showConfirmButton: false,
        });
        fetchData();
      } catch {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to delete item',
          confirmButtonColor: '#0ea5e9',
        });
      }
    }
  };

  // ============ EDIT DATA ============
  const handleEdit = (item) => {
    setEditingId(item.id);
    setFormData(item);
    setIsModalOpen(true);
  };

  // ============ EXPORT TO CSV ============
  const exportToCSV = () => {
    if (!data || data.length === 0) {
      Swal.fire({
        icon: 'info',
        title: 'No Data',
        text: 'There is no data to export.',
        confirmButtonColor: '#0ea5e9',
      });
      return;
    }

    const headers = columns;
    const csvRows = [
      headers.join(','),
      ...data.map(item => 
        headers.map(col => {
          const key = col.toLowerCase().replace(/ /g, '_');
          const value = item[key] || item[col.toLowerCase()] || '';
          return `"${String(value).replace(/"/g, '""')}"`;
        }).join(',')
      )
    ];

    const csv = csvRows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.toLowerCase().replace(/ /g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    Swal.fire({
      icon: 'success',
      title: 'Export Complete!',
      text: 'File has been exported successfully.',
      timer: 1500,
      showConfirmButton: false,
    });
  };

  // ============ FILTER & PAGINATION ============
  // Safely filter data (ensure data is array)
  const safeData = Array.isArray(data) ? data : [];
  
  const filteredData = safeData.filter(item =>
    Object.values(item).some(val =>
      String(val).toLowerCase().includes(search.toLowerCase())
    )
  );
  
  const totalPages = Math.ceil(filteredData.length / itemsPerPage) || 1;
  const paginatedData = filteredData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getValue = (item, col) => {
    const key = col.toLowerCase().replace(/ /g, '_');
    return item[key] || item[col.toLowerCase()] || '';
  };

  // ============ RENDER ============
  // Show error state
  if (error) {
    return (
      <div className={`p-6 text-center ${isDarkMode ? 'bg-slate-800 text-white' : 'bg-white'}`}>
        <div className="text-red-500 text-xl mb-4">⚠️ Connection Error</div>
        <p className={`${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
          Cannot connect to server. Please make sure backend is running on {API_BASE_URL}
        </p>
        <button 
          onClick={fetchData}
          className="mt-4 bg-cyan-600 text-white px-4 py-2 rounded-lg hover:bg-cyan-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={`p-6 ${isDarkMode ? 'bg-slate-800 text-white' : 'bg-white'}`}>
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{title}</h1>
          <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`}>
            {safeData.length} total records
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Refresh Button */}
          <button
            onClick={fetchData}
            className={`p-2 border rounded-lg transition-all ${
              isDarkMode 
                ? 'border-slate-700 hover:bg-slate-700 text-slate-400 hover:text-white' 
                : 'border-slate-200 hover:bg-slate-50 text-slate-600'
            }`}
            title="Refresh Data"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>

          {/* Export Button */}
          <button
            onClick={exportToCSV}
            className={`border ${isDarkMode ? 'border-slate-700 hover:bg-slate-700 text-slate-400 hover:text-white' : 'border-slate-200 hover:bg-slate-50 text-slate-600'} font-medium text-xs px-3 py-2 rounded-lg flex items-center gap-1.5 transition-all`}
          >
            <Download size={14} /> Export
          </button>

          {/* Add Button */}
          {!readOnly && <button
            onClick={() => {
              setEditingId(null);
              setFormData({});
              setIsModalOpen(true);
            }}
            className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-medium text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all shadow-md"
          >
            <Plus size={14} /> Add New
          </button>}
        </div>
      </div>

      {/* SEARCH BAR */}
      <div className="relative mb-4">
        <Search size={16} className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setCurrentPage(1);
          }}
          className={`w-full pl-9 pr-3 py-2 border rounded-lg text-sm transition-all outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 ${
            isDarkMode 
              ? 'bg-slate-700 border-slate-600 text-white placeholder:text-slate-400' 
              : 'bg-white border-slate-200 text-slate-700'
          }`}
        />
      </div>

      {/* TABLE */}
      <div className="overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={32} className="text-cyan-600 animate-spin" />
          </div>
        ) : (
          <table className={`w-full text-left border-collapse ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
            <thead>
              <tr className={`border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'} ${
                isDarkMode ? 'bg-slate-700/50' : 'bg-gradient-to-r from-slate-50 to-slate-100'
              }`}>
                {columns.map(col => (
                  <th key={col} className={`py-3 px-4 text-xs font-semibold uppercase tracking-wider ${
                    isDarkMode ? 'text-slate-400' : 'text-slate-400'
                  }`}>
                    {col}
                  </th>
                ))}
                <th className={`py-3 px-4 text-xs font-semibold uppercase tracking-wider text-center ${
                  isDarkMode ? 'text-slate-400' : 'text-slate-400'
                }`}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDarkMode ? 'divide-slate-700' : 'divide-slate-100'}`}>
              {paginatedData.length > 0 ? (
                paginatedData.map((item) => (
                  <tr key={item.id} className={`${
                    isDarkMode ? 'hover:bg-slate-700/50' : 'hover:bg-slate-50/50'
                  } transition-colors`}>
                    {columns.map(col => (
                      <td key={col} className={`py-3 px-4 text-sm ${
                        isDarkMode ? 'text-slate-300' : 'text-slate-600'
                      }`}>
                        {getValue(item, col)}
                      </td>
                    ))}
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-2">
                        {!readOnly && <button
                          onClick={() => handleEdit(item)}
                          className={`p-1.5 border rounded-lg transition-all ${
                            isDarkMode 
                              ? 'border-slate-600 text-cyan-400 hover:bg-slate-600' 
                              : 'border-slate-200 text-cyan-600 hover:bg-cyan-50'
                          }`}
                          title="Edit"
                        >
                          <Edit3 size={14} />
                        </button>}
                        {!readOnly && <button
                          onClick={() => handleDelete(item.id)}
                          className={`p-1.5 border rounded-lg transition-all ${
                            isDarkMode 
                              ? 'border-slate-600 text-red-400 hover:bg-slate-600' 
                              : 'border-slate-200 text-red-500 hover:bg-red-50'
                          }`}
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length + 1} className={`py-8 text-center text-sm ${
                    isDarkMode ? 'text-slate-500' : 'text-slate-400'
                  }`}>
                    <div className="flex flex-col items-center gap-2">
                      <Search size={32} className="opacity-30" />
                      <span>No records found</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* PAGINATION */}
      {!loading && safeData.length > 0 && (
        <div className={`flex flex-col sm:flex-row justify-between items-center gap-3 mt-4 pt-3 border-t text-xs font-semibold ${
          isDarkMode ? 'text-slate-400 border-slate-700' : 'text-slate-400 border-slate-100'
        }`}>
          <div>
            Showing {paginatedData.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} to{' '}
            {Math.min(currentPage * itemsPerPage, filteredData.length)} of {filteredData.length} entries
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className={`px-3 py-1 border rounded-lg transition-all flex items-center gap-1 ${
                isDarkMode 
                  ? 'border-slate-700 bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-40' 
                  : 'border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40'
              }`}
            >
              <ChevronLeft size={12} /> Prev
            </button>
            
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const pageNum = i + 1;
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                    currentPage === pageNum
                      ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-sm'
                      : isDarkMode 
                        ? 'bg-slate-800 border border-slate-700 text-slate-400 hover:bg-slate-700' 
                        : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            
            {totalPages > 5 && <span className="text-slate-400">...</span>}
            
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className={`px-3 py-1 border rounded-lg transition-all flex items-center gap-1 ${
                isDarkMode 
                  ? 'border-slate-700 bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-40' 
                  : 'border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40'
              }`}
            >
              Next <ChevronRight size={12} />
            </button>
          </div>
        </div>
      )}

      {/* MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white'} border rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl`}>
            <div className="flex justify-between items-center border-b pb-3">
              <h2 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                {editingId ? 'Edit Item' : 'Add New Item'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className={`p-1 rounded-lg transition-all ${
                  isDarkMode ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-400'
                }`}
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {columns.map(col => {
                const fieldName = col.toLowerCase().replace(/ /g, '_');
                return (
                  <div key={col}>
                    <label className={`block text-xs font-semibold uppercase mb-1 ${
                      isDarkMode ? 'text-slate-400' : 'text-slate-500'
                    }`}>
                      {col}
                    </label>
                    <input
                      type="text"
                      value={formData[fieldName] || formData[col.toLowerCase()] || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        [fieldName]: e.target.value
                      })}
                      className={`w-full border rounded-lg p-2.5 text-sm transition-all outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 ${
                        isDarkMode 
                          ? 'bg-slate-700 border-slate-600 text-white' 
                          : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    />
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-2 mt-6 pt-3 border-t">
              <button
                onClick={() => setIsModalOpen(false)}
                className={`px-4 py-2 border rounded-lg text-sm font-medium transition-all ${
                  isDarkMode 
                    ? 'border-slate-600 text-slate-300 hover:bg-slate-700' 
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={saveData}
                disabled={loading}
                className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-medium text-sm rounded-lg transition-all flex items-center gap-2 disabled:opacity-70"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                {loading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}