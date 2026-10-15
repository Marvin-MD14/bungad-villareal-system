import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import WizardStepIndicator from './WizardStepIndicator';
import AddStaffStep from './AddStaffStep';
import AddCatalogItemsStep from './AddCatalogItemsStep';
import ConfigureBranchStep from './ConfigureBranchStep';
import { api } from '../utils/api';

const WIZARD_STORAGE_KEY = 'wizard_progress_';

export default function BusinessSetupWizard({
  business,
  isOpen,
  onComplete,
  onContinueLater,
  isDarkMode = false,
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [wizardData, setWizardData] = useState({
    staff: [],
    catalogItems: [],
    branchSettings: null,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mainBranchId, setMainBranchId] = useState(null);

  const stepLabels = ['Add Staff', 'Add Catalog Items', 'Configure Branch'];
  const totalSteps = 3;

  useEffect(() => {
    if (business?.id) {
      const saved = localStorage.getItem(WIZARD_STORAGE_KEY + business.id);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.timestamp && Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
            setCurrentStep(parsed.currentStep);
            setWizardData(parsed.wizardData);
          }
        } catch (e) {
          console.error('Failed to parse saved wizard data:', e);
        }
      }

      const loadBranch = async () => {
        try {
          const response = await api.get('/branches/?business=' + business.id);
          const branches = response.data.results || response.data;
          if (branches.length > 0) {
            setMainBranchId(branches[0].id);
          }
        } catch (error) {
          console.error('Failed to load branch:', error);
        }
      };
      loadBranch();
    }
  }, [business?.id]);

  useEffect(() => {
    if (business?.id) {
      localStorage.setItem(
        WIZARD_STORAGE_KEY + business.id,
        JSON.stringify({
          currentStep,
          wizardData,
          timestamp: Date.now(),
        })
      );
    }
  }, [currentStep, wizardData, business?.id]);

  const handleStaffNext = (staff) => {
    setWizardData({ ...wizardData, staff });
    setCurrentStep(1);
  };

  const handleCatalogNext = (items) => {
    setWizardData({ ...wizardData, catalogItems: items });
    setCurrentStep(2);
  };

  const handleBranchComplete = async (settings) => {
    setIsSubmitting(true);
    try {
      if (mainBranchId && settings) {
        await api.patch('/branches/' + mainBranchId + '/', settings);
      }

      if (wizardData.staff.length > 0) {
        for (const staff of wizardData.staff) {
          await api.post('/user-access/', {
            user: staff.userId,
            role: staff.role,
            business: business.id,
            is_active: true,
          });
        }
      }

      if (wizardData.catalogItems.length > 0) {
        const businessItems = wizardData.catalogItems.map((itemId) => ({
          item_id: itemId,
          is_available: true,
        }));
        try {
          await api.post('/catalog/business-items/batch/', {
            business_id: business.id,
            items: businessItems,
          });
        } catch (batchError) {
          for (const bi of businessItems) {
            try {
              await api.post('/catalog/business-items/', {
                business: business.id,
                item: bi.item_id,
                is_available: bi.is_available,
              });
            } catch (e) {
              console.error('Failed to create business item:', e);
            }
          }
        }
      }

      localStorage.removeItem(WIZARD_STORAGE_KEY + business.id);
      onComplete();
    } catch (error) {
      console.error('Failed to complete wizard:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    setCurrentStep((prev) => Math.min(prev + 1, totalSteps - 1));
  };

  const handleContinueLater = () => {
    onContinueLater();
  };

  if (!isOpen || !business) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleContinueLater} />
      <div className={"relative z-10 w-full max-w-lg mx-4 rounded-2xl shadow-2xl " + (isDarkMode ? "bg-slate-900" : "bg-white")}>
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-bold">Setup: {business.name}</h2>
          <button
            onClick={handleContinueLater}
            className={"p-1 rounded-lg transition " + (isDarkMode ? "hover:bg-slate-800" : "hover:bg-slate-100")}
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-4">
          <WizardStepIndicator
            currentStep={currentStep}
            totalSteps={totalSteps}
            stepLabels={stepLabels}
            isDarkMode={isDarkMode}
          />
        </div>

        <div className="p-6">
          {currentStep === 0 && (
            <AddStaffStep
              businessId={business.id}
              initialData={wizardData.staff}
              onNext={handleStaffNext}
              onSkip={handleSkip}
              isDarkMode={isDarkMode}
            />
          )}
          {currentStep === 1 && (
            <AddCatalogItemsStep
              businessId={business.id}
              initialData={wizardData.catalogItems}
              onNext={handleCatalogNext}
              onSkip={handleSkip}
              isDarkMode={isDarkMode}
            />
          )}
          {currentStep === 2 && (
            <ConfigureBranchStep
              businessId={business.id}
              branchId={mainBranchId}
              initialData={wizardData.branchSettings}
              onComplete={handleBranchComplete}
              onSkip={() => {
                localStorage.removeItem(WIZARD_STORAGE_KEY + business.id);
                onComplete();
              }}
              isDarkMode={isDarkMode}
            />
          )}
        </div>

        {isSubmitting && (
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center rounded-2xl">
            <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-lg">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-cyan-500" />
                <span className="text-sm font-medium">Saving...</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

