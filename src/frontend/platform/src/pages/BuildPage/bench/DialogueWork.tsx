// DialogueWork.tsx
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import LingSiWork from "./LingSiWork";
import Index from "./index";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/mep-ui/tabs";

export default function DialogueWork() {
  const [formData, setFormData] = useState(null); // For sharing data between tabs
  const [defaultValue] = useState("client");
  const { t, i18n } = useTranslation();
  useEffect(() => {
    i18n.loadNamespaces('tool');
  }, [i18n]);

  return (
    <div className="w-full h-full px-2 pt-4 relative flex flex-col">
      <Tabs defaultValue={defaultValue} className="w-full flex-1 flex flex-col min-h-0">
        <TabsList className="shrink-0">
          <TabsTrigger value="client">{t('bench.daily')}</TabsTrigger>
          <TabsTrigger value="lingsi" className="roundedrounded-xl">{t('bench.lingsi')}</TabsTrigger>
        </TabsList>
        <TabsContent value="client" key="client-tab" className="flex-1 min-h-0 flex flex-col">
          <Index formData={formData} setFormData={setFormData} />
        </TabsContent>
        <TabsContent value="lingsi" className="flex-1 min-h-0 flex flex-col">
          <LingSiWork formData={formData} setFormData={setFormData} />
        </TabsContent>
      </Tabs>
    </div>
  );
}