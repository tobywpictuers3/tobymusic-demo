import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, RefreshCw, Upload, Image as ImageIcon, FileAudio, Link2, File as FileIcon, Trash2, Eye } from "lucide-react";

import { addFile, deleteFile, getFiles, updateFile } from "@/lib/storage";
import { workerApi } from "@/lib/workerApi";
import { toast } from "@/hooks/use-toast";
import type { FileEntry } from "@/lib/types";

import HandwriteCanvas from "./HandwriteCanvas";
import FileViewer from "./FileViewer";

interface StudentFilesProps {
  studentId: string;
}

type AddMode = "upload" | "camera" | "link" | "newpage";
type NewPageTemplate = "blank" | "lines" | "staff";

const StudentFiles = ({ studentId }: StudentFilesProps) => {
  const [refreshTick, setRefreshTick] = useState(0);
  const files = useMemo(() => getFiles().filter((f) => f.studentId === studentId), [studentId, refreshTick]);

  const [showDialog, setShowDialog] = useState(false);
  const [mode, setMode] = useState<AddMode>("upload");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  const [template, setTemplate] = useState<NewPageTemplate>("blank");

  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [viewer, setViewer] = useState<{ open: boolean; title: string; url: string }>({
    open: false,
    title: "",
    url: "",
  });

  useEffect(() => {
    // reset form when opening
    if (!showDialog) {
      setMode("upload");
      setTitle("");
      setDescription("");
      setLinkUrl("");
      setTemplate("blank");
      setSelectedFile(null);
    }
  }, [showDialog]);

  const handleRefresh = () => {
    setRefreshTick((x) => x + 1);
    toast({ title: "רענון קבצים", description: "הקבצים עודכנו" });
  };

  const openViewer = (file: FileEntry) => {
    setViewer({ open: true, title: file.name, url: file.webViewLink });
  };

  const getFileIcon = (file: FileEntry) => {
    const fileName = file.name || "";
    const ext = fileName.toLowerCase().split(".").pop();
    if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext || "")) return <ImageIcon className="h-5 w-5 text-primary" />;
    if (ext === "pdf") return <FileIcon className="h-5 w-5 text-red-500" />;
    if (["mp3", "wav", "ogg", "m4a"].includes(ext || "")) return <FileAudio className="h-5 w-5 text-green-500" />;
    if (file.kind === "link") return <Link2 className="h-5 w-5 text-blue-500" />;
    return <FileText className="h-5 w-5 text-primary" />;
  };

  const requireTitle = () => {
    if (!title.trim()) {
      toast({ title: "שגיאה", description: "יש למלא כותרת", variant: "destructive" });
      return false;
    }
    return true;
  };

  const uploadPhysicalFileToDropbox = async (file: File, overrideName?: string) => {
    const fixedFile =
      overrideName && overrideName.trim()
        ? new File([file], overrideName.trim(), { type: file.type || "application/octet-stream" })
        : file;

    const r = await workerApi.uploadAttachment(fixedFile);
    if (!r.success) throw new Error(r.error || "UPLOAD_FAILED");

    // Worker returns { ok, path, webViewLink, name, size, type } (based on your existing worker behavior)
    return r.data as any;
  };

  const handleAdd = async () => {
    try {
      if (mode === "link") {
        if (!requireTitle()) return;
        if (!linkUrl.trim()) {
          toast({ title: "שגיאה", description: "יש להדביק קישור", variant: "destructive" });
          return;
        }

        addFile({
          studentId,
          name: title.trim(),
          description: description.trim() || undefined,
          webViewLink: linkUrl.trim(),
          kind: "link",
        });

        setShowDialog(false);
        handleRefresh();
        toast({ title: "הצלחה", description: "הקישור נשמר" });
        return;
      }

      if (mode === "upload" || mode === "camera") {
        if (!selectedFile) {
          toast({ title: "שגיאה", description: "בחרי קובץ להעלאה", variant: "destructive" });
          return;
        }
        if (!requireTitle()) return;

        // preserve extension if user gave title without ext
        const origExt = selectedFile.name.includes(".") ? "." + selectedFile.name.split(".").pop() : "";
        const titleHasExt = title.trim().includes(".");
        const finalName = titleHasExt ? title.trim() : `${title.trim()}${origExt}`;

        const uploaded = await uploadPhysicalFileToDropbox(selectedFile, finalName);

        addFile({
          studentId,
          name: uploaded.name || finalName,
          description: description.trim() || undefined,
          webViewLink: uploaded.webViewLink,
          dropboxPath: uploaded.path,
          kind: "upload",
          mimeType: uploaded.type || selectedFile.type || undefined,
          size: uploaded.size || selectedFile.size || undefined,
        });

        setShowDialog(false);
        handleRefresh();
        toast({ title: "הצלחה", description: "הקובץ הועלה ונשמר בדרופבוקס" });
        return;
      }

      // mode === newpage handled by HandwriteCanvas "onSave"
    } catch (e) {
      toast({ title: "שגיאה", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleDelete = async (file: FileEntry) => {
    try {
      // delete from dropbox if we have path
      if (file.dropboxPath) {
        const r = await workerApi.deleteAttachment(file.dropboxPath);
        if (!r.success) {
          // still allow deleting from DB if dropbox already missing
          // (workerApi already treats not_found as success)
          throw new Error(r.error || "DELETE_FAILED");
        }
      }

      await deleteFile(file.id);
      handleRefresh();
      toast({ title: "נמחק", description: "הקובץ הוסר" });
    } catch (e) {
      toast({ title: "שגיאה", description: (e as Error).message, variant: "destructive" });
    }
  };

  return (
    <Card className="card-gradient card-shadow">
      <CardHeader>
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <CardTitle className="text-2xl flex items-center gap-2">
              <FileText className="h-6 w-6" />
              קבצים
            </CardTitle>

            <div className="flex gap-2">
              <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Upload className="h-4 w-4 mr-2" />
                    הוספת קובץ
                  </Button>
                </DialogTrigger>

                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>הוספת קובץ חדש</DialogTitle>
                  </DialogHeader>

                  <div className="space-y-4">
                    <div>
                      <Label>סוג הוספה</Label>
                      <Select value={mode} onValueChange={(v) => setMode(v as AddMode)}>
                        <SelectTrigger>
                          <SelectValue placeholder="בחרי סוג" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="upload">העלאת קובץ (אחסון/Drive)</SelectItem>
                          <SelectItem value="camera">צילום/סריקה (מצלמה)</SelectItem>
                          <SelectItem value="link">קישור</SelectItem>
                          <SelectItem value="newpage">קובץ חדש (דף ריק/שורות/חמשות)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {mode !== "newpage" && (
                      <>
                        <div>
                          <Label>כותרת</Label>
                          <Input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="לדוגמה: תווים שיעור 5"
                          />
                        </div>

                        <div>
                          <Label>תיאור (אופציונלי)</Label>
                          <Input
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="הסבר קצר על הקובץ"
                          />
                        </div>
                      </>
                    )}

                    {(mode === "upload" || mode === "camera") && (
                      <div>
                        <Label>בחירת קובץ</Label>
                        <Input
                          type="file"
                          accept="image/*,application/pdf,audio/*"
                          capture={mode === "camera" ? "environment" : undefined}
                          onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                        />
                        <div className="text-xs text-muted-foreground mt-1">
                          בטאבלט זה יאפשר לבחור גם Drive/Files לפי מה שמותקן במכשיר.
                        </div>
                      </div>
                    )}

                    {mode === "link" && (
                      <div>
                        <Label>קישור</Label>
                        <Input
                          value={linkUrl}
                          onChange={(e) => setLinkUrl(e.target.value)}
                          placeholder="הדביקי כאן קישור (Google Drive / Dropbox / כל כתובת)"
                        />
                      </div>
                    )}

                    {mode === "newpage" && (
                      <div className="space-y-3">
                        <div>
                          <Label>שם הדף</Label>
                          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="לדוגמה: תרגיל אצבעות 3" />
                        </div>

                        <div>
                          <Label>סוג דף</Label>
                          <Select value={template} onValueChange={(v) => setTemplate(v as NewPageTemplate)}>
                            <SelectTrigger>
                              <SelectValue placeholder="בחרי תבנית" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="blank">דף ריק</SelectItem>
                              <SelectItem value="lines">דף שורות</SelectItem>
                              <SelectItem value="staff">דף חמשות</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="rounded-lg border p-3 bg-secondary/20">
                          <HandwriteCanvas
                            initialTemplate={template}
                            initialTitle={title}
                            onCancel={() => setShowDialog(false)}
                            onSave={async ({ png, pdf }) => {
                              if (!title.trim()) {
                                toast({ title: "שגיאה", description: "יש לתת שם לדף", variant: "destructive" });
                                return;
                              }

                              // Upload BOTH PNG and PDF. Keep both as separate files in list.
                              const baseName = title.trim();

                              // PNG
                              const pngFile = new File([png], `${baseName}.png`, { type: "image/png" });
                              const uploadedPng = await uploadPhysicalFileToDropbox(pngFile, `${baseName}.png`);

                              addFile({
                                studentId,
                                name: `${baseName}.png`,
                                description: description.trim() || "דף כתיבה (PNG)",
                                webViewLink: uploadedPng.webViewLink,
                                dropboxPath: uploadedPng.path,
                                kind: "handwrite",
                                template,
                                mimeType: "image/png",
                                size: pngFile.size,
                              });

                              // PDF
                              const pdfFile = new File([pdf], `${baseName}.pdf`, { type: "application/pdf" });
                              const uploadedPdf = await uploadPhysicalFileToDropbox(pdfFile, `${baseName}.pdf`);

                              addFile({
                                studentId,
                                name: `${baseName}.pdf`,
                                description: description.trim() || "דף כתיבה (PDF)",
                                webViewLink: uploadedPdf.webViewLink,
                                dropboxPath: uploadedPdf.path,
                                kind: "handwrite",
                                template,
                                mimeType: "application/pdf",
                                size: pdfFile.size,
                              });

                              setShowDialog(false);
                              handleRefresh();
                              toast({ title: "הצלחה", description: "הדף נשמר כ-PNG וכ-PDF בדרופבוקס" });
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {mode !== "newpage" && (
                      <Button onClick={handleAdd} className="w-full hero-gradient">
                        שמירה
                      </Button>
                    )}
                  </div>
                </DialogContent>
              </Dialog>

              <Button onClick={handleRefresh} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                רענון
              </Button>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            כאן נמצאים קבצים אישיים לתלמידה: העלאות, דפי כתיבה, וקישורים.
          </p>
        </div>
      </CardHeader>

      <CardContent>
        {files.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">אין קבצים זמינים כרגע</div>
        ) : (
          <div className="space-y-3">
            {files
              .slice()
              .sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime())
              .map((file) => (
                <div key={file.id} className="p-4 bg-secondary/30 rounded-lg hover:bg-secondary/50 transition-colors">
                  <div className="flex items-start gap-3">
                    {getFileIcon(file)}
                    <div className="flex-1">
                      <div className="font-medium">{file.name}</div>
                      {file.description && <div className="text-sm text-muted-foreground mt-1">{file.description}</div>}
                      <div className="text-xs text-muted-foreground mt-2">
                        הועלה ב-{new Date(file.uploadDate).toLocaleDateString("he-IL")}
                      </div>

                      <div className="mt-3 flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => openViewer(file)}>
                          <Eye className="h-4 w-4 mr-2" />
                          צפייה
                        </Button>

                        <Button size="sm" variant="outline" onClick={() => window.open(file.webViewLink, "_blank")}>
                          פתיחה בטאב
                        </Button>

                        <Button size="sm" variant="destructive" onClick={() => handleDelete(file)}>
                          <Trash2 className="h-4 w-4 mr-2" />
                          מחיקה
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </CardContent>

      <FileViewer
        open={viewer.open}
        onOpenChange={(v) => setViewer((s) => ({ ...s, open: v }))}
        title={viewer.title}
        url={viewer.url}
      />
    </Card>
  );
};

export default StudentFiles;
