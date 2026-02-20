import pandas as pd
import json

patient_file = '/Users/kesavp/Downloads/Patient_Clinical_Data.xlsx'
hospital_file = '/Users/kesavp/Downloads/Hospital_Resource_Status.xlsx'

df_p = pd.read_excel(patient_file)
print("Patient Columns:", df_p.columns.tolist())
if len(df_p) > 0:
    print("Patient Sample Row 0:", df_p.iloc[0].to_dict())

df_h = pd.read_excel(hospital_file)
print("Hospital Columns:", df_h.columns.tolist())
if len(df_h) > 0:
    print("Hospital Sample Row 0:", df_h.iloc[0].to_dict())
